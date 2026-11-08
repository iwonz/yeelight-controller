import EventEmitter from 'events';
import dgram from 'dgram';
import {
  YeelightCommand,
  YeelightCommandResult,
  YeelightDeviceEvents,
  YeelightDeviceProps,
  YeelightDiscoveryEvents,
  YeelightIncomingMessage,
} from './types';
import { YeelightDeviceController } from './device-controller';
import { parseYeelightDiscoveryMessage } from './discovery-message';
import { YeelightDeviceOptions } from './device-transport';

type EventListener = Parameters<EventEmitter['on']>[1];

const MULTICAST_IP = '239.255.255.250';
const MULTICAST_PORT = 1982;

export interface YeelightDiscoveryOptions {
  socketFactory?: () => dgram.Socket;
  deviceFactory?: (
    state: ConstructorParameters<typeof YeelightDeviceController>[0],
    options: YeelightDeviceOptions,
  ) => YeelightDeviceController;
}

export interface YeelightDiscoveryEventMap {
  [YeelightDiscoveryEvents.ERROR]: [error: Error];
  [YeelightDiscoveryEvents.DISCONNECT]: [error?: Error];
  [YeelightDiscoveryEvents.DISCOVER_DEVICE]: [device: YeelightDeviceController];
  [YeelightDiscoveryEvents.CONNECT_DEVICE]: [device: YeelightDeviceController];
  [YeelightDiscoveryEvents.DISCONNECT_DEVICE]: [device: YeelightDeviceController, error?: Error];
  [YeelightDiscoveryEvents.DEVICE_CHANGE_PROPS]: [
    device: YeelightDeviceController,
    props: Readonly<YeelightDeviceProps>,
  ];
  [YeelightDiscoveryEvents.DEVICE_DATA]: [device: YeelightDeviceController, data: YeelightIncomingMessage];
  [YeelightDiscoveryEvents.DEVICE_ERROR]: [device: YeelightDeviceController, error: Error];
}

export class YeelightDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private devices: Map<string, YeelightDeviceController> = new Map();
  private readonly socketFactory: () => dgram.Socket;
  private readonly deviceFactory: NonNullable<YeelightDiscoveryOptions['deviceFactory']>;

  constructor(options: YeelightDiscoveryOptions = {}) {
    super();

    this.socketFactory = options.socketFactory ?? (() => dgram.createSocket({ type: 'udp4', reuseAddr: true }));
    this.deviceFactory =
      options.deviceFactory ?? ((state, deviceOptions) => new YeelightDeviceController(state, deviceOptions));
  }

  public on<E extends YeelightDiscoveryEvents>(
    event: E,
    listener: (...args: YeelightDiscoveryEventMap[E]) => void,
  ): this {
    return super.on(event, listener as EventListener);
  }

  public emit<E extends YeelightDiscoveryEvents>(event: E, ...args: YeelightDiscoveryEventMap[E]): boolean {
    return super.emit(event, ...args);
  }

  public activate(): void {
    if (this.socket) {
      return;
    }

    const socket = this.socketFactory();
    this.socket = socket;

    socket.on('listening', () => {
      if (this.socket !== socket) {
        return;
      }

      try {
        socket.addMembership(MULTICAST_IP);
        this.rescan();
      } catch (error) {
        this.handleSocketError(socket, error instanceof Error ? error : new Error(String(error)));
      }
    });

    socket.on('error', (socketError: Error) => {
      this.handleSocketError(socket, socketError);
    });

    socket.on('message', (deviceInfo: Buffer) => {
      const message = parseYeelightDiscoveryMessage(deviceInfo);
      if (!message) {
        return;
      }

      const state = {
        id: message.id,
        model: message.model,
        version: message.version,
        support: message.support,
        location: message.location,
        host: message.host,
        port: message.port,
      };
      const existingDevice = this.devices.get(message.id);
      if (existingDevice) {
        existingDevice.updateFromDiscovery(state, message.props);
        if (!existingDevice.isConnected()) {
          this.connectDevice(existingDevice);
        }
        return;
      }

      const device = this.deviceFactory(state, { initialProps: message.props });

      this.devices.set(device.getId(), device);
      this.emit(YeelightDiscoveryEvents.DISCOVER_DEVICE, device);

      device.on(YeelightDeviceEvents.CONNECT, () => {
        this.emit(YeelightDiscoveryEvents.CONNECT_DEVICE, device);
      });

      device.on(YeelightDeviceEvents.DISCONNECT, (deviceError) => {
        this.emit(YeelightDiscoveryEvents.DISCONNECT_DEVICE, device, deviceError);
      });

      device.on(YeelightDeviceEvents.PROPS_CHANGE, (props) => {
        this.emit(YeelightDiscoveryEvents.DEVICE_CHANGE_PROPS, device, props);
      });

      device.on(YeelightDeviceEvents.DATA, (data) => {
        this.emit(YeelightDiscoveryEvents.DEVICE_DATA, device, data);
      });

      device.on(YeelightDeviceEvents.ERROR, (deviceError) => {
        this.emit(YeelightDiscoveryEvents.DEVICE_ERROR, device, deviceError);
      });

      this.connectDevice(device);
    });

    try {
      socket.bind(MULTICAST_PORT, () => {
        if (this.socket === socket) {
          try {
            socket.setBroadcast(true);
          } catch (error) {
            this.handleSocketError(socket, error instanceof Error ? error : new Error(String(error)));
          }
        }
      });
    } catch (error) {
      this.handleSocketError(socket, error instanceof Error ? error : new Error(String(error)));
    }
  }

  public async deactivate(error?: Error): Promise<void> {
    const socket = this.socket;
    const devices = Array.from(this.devices.values());
    this.socket = null;
    this.devices.clear();

    await Promise.all(devices.map((device) => device.close(error)));

    if (socket) {
      socket.removeAllListeners();
      await new Promise<void>((resolve) => {
        try {
          socket.close(() => resolve());
        } catch {
          resolve();
        }
      });
    }

    if (socket || devices.length > 0 || error) {
      this.emit(YeelightDiscoveryEvents.DISCONNECT, error);
    }
  }

  public rescan(): void {
    const socket = this.socket;
    if (!socket) {
      return;
    }

    const buffer = Buffer.from('M-SEARCH * HTTP/1.1\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n');
    socket.send(buffer, 0, buffer.length, MULTICAST_PORT, MULTICAST_IP, (sendError) => {
      if (sendError) {
        this.handleSocketError(socket, sendError);
      }
    });
  }

  public command<M extends string>(command: YeelightCommand<M>): Promise<YeelightCommandResult<M>[]> {
    const promises: Promise<YeelightCommandResult<M>>[] = [];

    this.devices.forEach((device) => {
      promises.push(device.command(command));
    });

    return Promise.all(promises);
  }

  public getDevices(): YeelightDeviceController[] {
    return Array.from(this.devices.values());
  }

  public getDeviceById(deviceId: string): YeelightDeviceController | null {
    return this.devices.get(deviceId) || null;
  }

  public getDeviceByName(deviceName: string): YeelightDeviceController | null {
    return (
      Array.from(this.devices.values()).find((device) => {
        return device.getName() === deviceName;
      }) || null
    );
  }

  private handleSocketError(socket: dgram.Socket, error: Error): void {
    if (this.socket !== socket) {
      return;
    }

    this.emit(YeelightDiscoveryEvents.ERROR, error);
    void this.deactivate(error);
  }

  private connectDevice(device: YeelightDeviceController): void {
    void device.connect().catch((deviceError) => {
      this.emit(
        YeelightDiscoveryEvents.DEVICE_ERROR,
        device,
        deviceError instanceof Error ? deviceError : new Error(String(deviceError)),
      );
    });
  }
}
