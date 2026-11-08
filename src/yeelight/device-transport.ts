import EventEmitter from 'node:events';
import net from 'node:net';
import {
  YeelightCommandTimeoutError,
  YeelightConnectionClosedError,
  YeelightDuplicateCommandIdError,
  YeelightNotConnectedError,
  YeelightProtocolError,
} from './errors';
import { CommandRateLimiter } from './rate-limiter';
import {
  YEELIGHT_PROPS,
  type YeelightCommand,
  type YeelightCommandResult,
  YeelightConnectionState,
  type YeelightDeviceEventMap,
  YeelightDeviceEvents,
  type YeelightDeviceInfo,
  type YeelightDeviceProps,
  type YeelightIncomingMessage,
  YeelightMethod,
} from './types';
import { requireProtocolInteger } from './validation';

type EventListener = Parameters<EventEmitter['on']>[1];

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: NodeJS.Timeout;
}

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseIncomingMessage = (frame: string): YeelightIncomingMessage => {
  const value: unknown = JSON.parse(frame);
  if (!isRecord(value)) {
    throw new Error('Invalid Yeelight message');
  }

  if (typeof value.id === 'number' && Array.isArray(value.result)) {
    return { id: value.id, result: value.result };
  }
  if (
    typeof value.id === 'number' &&
    isRecord(value.error) &&
    typeof value.error.code === 'number' &&
    typeof value.error.message === 'string'
  ) {
    return {
      id: value.id,
      error: { code: value.error.code, message: value.error.message },
    };
  }
  if (value.method === 'props' && isRecord(value.params)) {
    const params: YeelightDeviceProps = {};
    Object.entries(value.params).forEach(([property, propertyValue]) => {
      if (typeof propertyValue === 'string' && YEELIGHT_PROPS.includes(property as keyof YeelightDeviceProps)) {
        params[property as keyof YeelightDeviceProps] = propertyValue;
      }
    });
    return { method: 'props', params };
  }

  throw new Error('Invalid Yeelight message shape');
};

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
  private connectReject: ((reason: unknown) => void) | null = null;
  private lastSeen = Date.now();
  private readonly rateLimiter: CommandRateLimiter;

  constructor(state: YeelightDeviceInfo, options: YeelightDeviceOptions = {}) {
    super();

    this.device = state;
    this.props = { ...options.initialProps };
    this.commandTimeout = requireProtocolInteger(options.commandTimeout ?? 5000, 'commandTimeout', 1);
    const maxCommands = requireProtocolInteger(options.maxCommandsPerWindow ?? 60, 'maxCommandsPerWindow', 1);
    const rateLimitWindow = requireProtocolInteger(options.rateLimitWindow ?? 60000, 'rateLimitWindow', 1);
    this.rateLimiter = new CommandRateLimiter(maxCommands, rateLimitWindow);
  }

  public on<E extends YeelightDeviceEvents>(event: E, listener: (...args: YeelightDeviceEventMap[E]) => void): this {
    return super.on(event, listener as EventListener);
  }

  public emit<E extends YeelightDeviceEvents>(event: E, ...args: YeelightDeviceEventMap[E]): boolean {
    return super.emit(event, ...args);
  }

  public connect(): Promise<void> {
    if (this.connectionState === YeelightConnectionState.READY) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectionState = YeelightConnectionState.CONNECTING;
    let resolveConnection: () => void = () => undefined;
    let rejectConnection: (reason: unknown) => void = () => undefined;
    const connectPromise = new Promise<void>((resolve, reject) => {
      resolveConnection = resolve;
      rejectConnection = reject;
    });
    this.connectPromise = connectPromise;
    this.connectResolve = resolveConnection;
    this.connectReject = rejectConnection;

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
              const response = parseIncomingMessage(frame);

              this.emit(YeelightDeviceEvents.DATA, response);

              if ('id' in response && this.pendingCommands.has(response.id)) {
                const pendingCommand = this.pendingCommands.get(response.id);
                this.pendingCommands.delete(response.id);
                if (pendingCommand) {
                  clearTimeout(pendingCommand.timeout);
                }

                if ('error' in response) {
                  pendingCommand?.reject(new YeelightProtocolError(response.id, response.error));
                } else {
                  pendingCommand?.resolve(response.result);
                }
              }

              if ('method' in response && response.method === 'props') {
                this.onPropsChange(response.params);
              }
            } catch (error) {
              const parseError = toError(error);
              this.emit(YeelightDeviceEvents.ERROR, parseError);
              this.finalizeDisconnect(parseError);
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
          this.finalizeDisconnect(toError(error));
        }
      });
    } catch (error) {
      this.finalizeDisconnect(toError(error));
    }

    return connectPromise;
  }

  public close(error?: Error): Promise<void> {
    if (this.connectionState === YeelightConnectionState.DISCONNECTED && !this.socket) {
      return Promise.resolve();
    }

    this.connectionState = YeelightConnectionState.CLOSING;
    this.finalizeDisconnect(error);

    return Promise.resolve();
  }

  public disconnect = (error?: Error): void => {
    void this.close(error);
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

  public async command<M extends string>(command: YeelightCommand<M>): Promise<YeelightCommandResult<M>> {
    if (this.device.support && !this.device.support.includes(command.method)) {
      throw new Error(
        `Method ${command.method} is not supported by device. Allowed: ${this.device.support.join(', ')}`,
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
      throw new YeelightDuplicateCommandIdError(id);
    }

    const result = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingCommands.delete(id)) {
          reject(new YeelightCommandTimeoutError(id, command.method, this.commandTimeout));
        }
      }, this.commandTimeout);

      this.pendingCommands.set(id, { resolve, reject, timeout });

      try {
        writableSocket.write(
          `${JSON.stringify({
            ...command,
            id,
          })}\r\n`,
        );
      } catch (error) {
        clearTimeout(timeout);
        this.pendingCommands.delete(id);
        reject(error);
      }
    });
    return result as YeelightCommandResult<M>;
  }

  public rawCommand<TResult = unknown>(method: string, params: readonly unknown[]): Promise<TResult> {
    return this.command({ method, params }) as Promise<TResult>;
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
    Object.entries(props).forEach(([prop, value]) => {
      this.props[prop as keyof YeelightDeviceProps] = value;
    });

    this.emit(YeelightDeviceEvents.PROPS_CHANGE, { ...this.props });
  }
}
