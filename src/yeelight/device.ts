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

export class YeelightDevice extends EventEmitter {
  private socket: net.Socket | null = null;

  private device: YeelightDeviceInfo;
  private props: YeelightDeviceProps = {};

  private commandPromiseResolvers: Map<number, (value: any) => void> = new Map();
  private commandId = 0;

  constructor(state: YeelightDeviceInfo) {
    super();

    this.device = state;
  }

  public connect(): void {
    try {
      this.socket = new net.Socket();

      this.socket.on('data', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString('utf-8'));

          this.emit(YeelightDeviceEvents.DATA, response);

          if (response.id && this.commandPromiseResolvers.has(response.id)) {
            this.commandPromiseResolvers.get(response.id)?.(response.result);
            this.commandPromiseResolvers.delete(response.id);
          }

          if (response?.method === 'props') {
            this.onPropsChange(response.params);
          }
        } catch (error) {
          this.emit(YeelightDeviceEvents.ERROR, error);
          this.disconnect();
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

        this.commandPromiseResolvers.set(id, resolve);
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
