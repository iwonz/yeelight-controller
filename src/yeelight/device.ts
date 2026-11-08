import EventEmitter from 'events';
import net from 'net';
import {
  YEELIGHT_PROPS,
  YeelightCommand,
  YeelightDeviceEvents,
  YeelightDeviceInfo,
  YeelightDeviceProps,
  YeelightMethod,
} from './types';
import { YeelightProtocolError } from './errors';

interface PendingCommand {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export class YeelightDevice extends EventEmitter {
  private socket: net.Socket | null = null;

  private device: YeelightDeviceInfo;
  private props: YeelightDeviceProps = {};
  private responseBuffer = Buffer.alloc(0);

  private pendingCommands: Map<number, PendingCommand> = new Map();
  private commandId = 0;

  constructor(state: YeelightDeviceInfo) {
    super();

    this.device = state;
  }

  public connect(): void {
    try {
      this.socket = new net.Socket();

      this.socket.on('data', (data: Buffer) => {
        this.responseBuffer = Buffer.concat([this.responseBuffer, data]);

        let boundary = this.responseBuffer.indexOf('\r\n');
        while (boundary !== -1) {
          const frame = this.responseBuffer.slice(0, boundary).toString('utf8');
          this.responseBuffer = this.responseBuffer.slice(boundary + 2);

          if (frame) {
            try {
              const response = JSON.parse(frame);

              this.emit(YeelightDeviceEvents.DATA, response);

              if (response.id && this.pendingCommands.has(response.id)) {
                const pendingCommand = this.pendingCommands.get(response.id);
                this.pendingCommands.delete(response.id);

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
              this.disconnect();
              return;
            }
          }

          boundary = this.responseBuffer.indexOf('\r\n');
        }
      });

      this.socket.on('error', (error: any) => {
        this.emit(YeelightDeviceEvents.ERROR, error);
      });

      this.socket.on('end', () => {
        this.disconnect();
      });

      this.socket.connect({ host: this.device.host, port: this.device.port }, () => {
        setTimeout(() => {
          this.command({
            method: YeelightMethod.GET_PROP,
            params: YEELIGHT_PROPS,
          }).then((response) => {
            YEELIGHT_PROPS.forEach((prop, index) => {
              this.props[prop] = response[index];
            });

            this.emit(YeelightDeviceEvents.CONNECT);
          });
        }, 20);
      });
    } catch (error) {
      this.disconnect(error);
    }
  }

  public disconnect = (error?: any): void => {
    this.socket?.destroy();
    this.socket = null;
    this.responseBuffer = Buffer.alloc(0);

    this.emit(YeelightDeviceEvents.DISCONNECT, error);
  };

  public command(command: YeelightCommand): Promise<any> {
    if (this.device.support && !this.device.support.includes(command.method)) {
      return Promise.reject(
        `Method ${command.method} does not support by device. Allowed only: ${this.device.support.join(', ')}`,
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const id = command.id || this.processCommandId();

        this.socket?.write(
          JSON.stringify({
            id,
            ...command,
          }) + '\r\n',
        );

        this.pendingCommands.set(id, { resolve, reject });
      } catch (error) {
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
