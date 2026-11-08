import EventEmitter from 'events';
import net from 'net';
import {
  YEELIGHT_PROPS,
  YeelightCommand,
  YeelightConnectionState,
  YeelightDeviceEvents,
  YeelightDeviceInfo,
  YeelightDeviceProps,
  YeelightMethod,
} from './types';
import {
  YeelightCommandTimeoutError,
  YeelightConnectionClosedError,
  YeelightDuplicateCommandIdError,
  YeelightNotConnectedError,
  YeelightProtocolError,
} from './errors';
import { CommandRateLimiter } from './rate-limiter';

interface PendingCommand {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: NodeJS.Timeout;
}

export interface YeelightDeviceOptions {
  commandTimeout?: number;
  initialProps?: YeelightDeviceProps;
  maxCommandsPerWindow?: number;
  rateLimitWindow?: number;
}

export class YeelightDeviceTransport extends EventEmitter {
  private socket: net.Socket | null = null;

  private device: YeelightDeviceInfo;
  private props: YeelightDeviceProps = {};
  private responseBuffer = Buffer.alloc(0);

  private pendingCommands: Map<number, PendingCommand> = new Map();
  private commandId = 0;
  private readonly commandTimeout: number;
  private connectionState = YeelightConnectionState.DISCONNECTED;
  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((reason: any) => void) | null = null;
  private lastSeen = Date.now();
  private readonly rateLimiter: CommandRateLimiter;

  constructor(state: YeelightDeviceInfo, options: YeelightDeviceOptions = {}) {
    super();

    this.device = state;
    this.props = { ...options.initialProps };
    this.commandTimeout = options.commandTimeout ?? 5000;
    this.rateLimiter = new CommandRateLimiter(options.maxCommandsPerWindow ?? 60, options.rateLimitWindow ?? 60000);
  }

  public connect(): Promise<void> {
    if (this.connectionState === YeelightConnectionState.READY) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectionState = YeelightConnectionState.CONNECTING;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        const socket = new net.Socket();
        this.socket = socket;

        socket.on('data', (data: Buffer) => {
          this.responseBuffer = Buffer.concat([this.responseBuffer, data]);

          let boundary = this.responseBuffer.indexOf('\r\n');
          while (boundary !== -1) {
            const frame = this.responseBuffer.slice(0, boundary).toString('utf8');
            this.responseBuffer = this.responseBuffer.slice(boundary + 2);

            if (frame) {
              try {
                const response = JSON.parse(frame);

                this.emit(YeelightDeviceEvents.DATA, response);

                if (response.id !== undefined && response.id !== null && this.pendingCommands.has(response.id)) {
                  const pendingCommand = this.pendingCommands.get(response.id);
                  this.pendingCommands.delete(response.id);
                  if (pendingCommand) {
                    clearTimeout(pendingCommand.timeout);
                  }

                  if (response.error) {
                    pendingCommand?.reject(new YeelightProtocolError(response.id, response.error));
                  } else {
                    pendingCommand?.resolve(response.result);
                  }
                }

                if (response?.method === 'props') {
                  this.onPropsChange(response.params);
                }
              } catch (error) {
                this.emit(YeelightDeviceEvents.ERROR, error);
                this.finalizeDisconnect(error instanceof Error ? error : undefined);
                return;
              }
            }

            boundary = this.responseBuffer.indexOf('\r\n');
          }
        });

        socket.on('error', (error: Error) => {
          this.emit(YeelightDeviceEvents.ERROR, error);
          this.finalizeDisconnect(error);
        });

        socket.on('end', () => {
          this.finalizeDisconnect();
        });

        socket.connect({ host: this.device.host, port: this.device.port }, async () => {
          try {
            const response = await this.command({
              method: YeelightMethod.GET_PROP,
              params: YEELIGHT_PROPS,
            });

            YEELIGHT_PROPS.forEach((prop, index) => {
              this.props[prop] = response[index];
            });

            this.connectionState = YeelightConnectionState.READY;
            const completeConnection = this.connectResolve;
            this.connectPromise = null;
            this.connectResolve = null;
            this.connectReject = null;
            this.emit(YeelightDeviceEvents.CONNECT);
            completeConnection?.();
          } catch (error) {
            this.finalizeDisconnect(error instanceof Error ? error : undefined);
          }
        });
      } catch (error) {
        this.finalizeDisconnect(error instanceof Error ? error : undefined);
      }
    });

    return this.connectPromise;
  }

  public close(error?: Error): Promise<void> {
    if (this.connectionState === YeelightConnectionState.DISCONNECTED && !this.socket) {
      return Promise.resolve();
    }

    this.connectionState = YeelightConnectionState.CLOSING;
    this.finalizeDisconnect(error);

    return Promise.resolve();
  }

  public disconnect = (error?: any): void => {
    void this.close(error instanceof Error ? error : undefined);
  };

  public isConnected(): boolean {
    return this.connectionState === YeelightConnectionState.READY;
  }

  public getConnectionState(): YeelightConnectionState {
    return this.connectionState;
  }

  private finalizeDisconnect(error?: Error): void {
    const wasActive =
      this.connectionState !== YeelightConnectionState.DISCONNECTED ||
      this.socket !== null ||
      this.connectPromise !== null ||
      this.pendingCommands.size > 0;

    if (!wasActive) {
      return;
    }

    const socket = this.socket;
    this.socket = null;
    socket?.removeAllListeners();
    socket?.destroy();
    this.responseBuffer = Buffer.alloc(0);

    const connectionError = new YeelightConnectionClosedError(error);
    this.rateLimiter.cancel(connectionError);
    this.pendingCommands.forEach((pendingCommand) => {
      clearTimeout(pendingCommand.timeout);
      pendingCommand.reject(connectionError);
    });
    this.pendingCommands.clear();

    const rejectConnection = this.connectReject;
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
    this.connectionState = YeelightConnectionState.DISCONNECTED;
    rejectConnection?.(error ?? connectionError);

    this.emit(YeelightDeviceEvents.DISCONNECT, error);
  }

  public async command(command: YeelightCommand): Promise<any> {
    if (this.device.support && !this.device.support.includes(command.method)) {
      return Promise.reject(
        `Method ${command.method} does not support by device. Allowed only: ${this.device.support.join(', ')}`,
      );
    }

    let socket = this.socket;
    if (!socket || socket.destroyed || !socket.writable) {
      throw new YeelightNotConnectedError();
    }
    await this.rateLimiter.acquire();

    socket = this.socket;
    if (!socket || socket.destroyed || !socket.writable) {
      throw new YeelightNotConnectedError();
    }
    const writableSocket = socket;

    const id = command.id ?? this.processCommandId();
    if (this.pendingCommands.has(id)) {
      return Promise.reject(new YeelightDuplicateCommandIdError(id));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingCommands.delete(id)) {
          reject(new YeelightCommandTimeoutError(id, command.method, this.commandTimeout));
        }
      }, this.commandTimeout);

      this.pendingCommands.set(id, { resolve, reject, timeout });

      try {
        writableSocket.write(
          JSON.stringify({
            ...command,
            id,
          }) + '\r\n',
        );
      } catch (error) {
        clearTimeout(timeout);
        this.pendingCommands.delete(id);
        reject(error);
      }
    });
  }

  public getId(): string {
    return this.device?.id || '';
  }

  public getName(): string {
    return this.props?.name || '';
  }

  public getProperties(): Readonly<YeelightDeviceProps> {
    return { ...this.props };
  }

  public getLastSeen(): number {
    return this.lastSeen;
  }

  public updateFromDiscovery(state: YeelightDeviceInfo, props: YeelightDeviceProps): void {
    this.device = { ...this.device, ...state };
    this.lastSeen = Date.now();

    const changed = Object.keys(props).some((prop) => {
      const property = prop as keyof YeelightDeviceProps;
      return this.props[property] !== props[property];
    });
    this.props = { ...this.props, ...props };

    if (changed) {
      this.emit(YeelightDeviceEvents.PROPS_CHANGE, { ...this.props });
    }
  }

  protected setCommandRateLimitBypassed(bypassed: boolean): void {
    this.rateLimiter.setBypassed(bypassed);
  }

  private processCommandId(): number {
    if (this.commandId >= 2e9) {
      this.commandId = 1;
    } else {
      this.commandId++;
    }

    return this.commandId;
  }

  private onPropsChange(props: YeelightDeviceProps): void {
    Object.keys(props).forEach((prop) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.props[prop] = props[prop];
    });

    this.emit(YeelightDeviceEvents.PROPS_CHANGE, this.props);
  }
}
