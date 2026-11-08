import EventEmitter from 'events';
import dgram from 'dgram';
import url from 'url';
import { YeelightCommand, YeelightDeviceEvents, YeelightDiscoveryEvents } from './types';
import { YeelightDeviceController } from './device-controller';

const MULTICAST_IP = '239.255.255.250';
const MULTICAST_PORT = 1982;

export interface YeelightDiscoveryOptions {
  socketFactory?: () => dgram.Socket;
}

export class YeelightDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private devices: Map<string, YeelightDeviceController> = new Map();
  private readonly socketFactory: () => dgram.Socket;

  constructor(options: YeelightDiscoveryOptions = {}) {
    super();

    this.socketFactory = options.socketFactory ?? (() => dgram.createSocket('udp4'));
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

      socket.addMembership(MULTICAST_IP);

      const buffer = Buffer.from('M-SEARCH * HTTP/1.1\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n');
      socket.send(buffer, 0, buffer.length, MULTICAST_PORT, MULTICAST_IP);
    });

    socket.on('message', (deviceInfo: Buffer) => {
      const headers: any = {};

      deviceInfo
        .toString()
        .split('\r\n')
        .forEach((header) => {
          ['id', 'Location', 'fw_ver', 'model', 'support'].forEach((supportedHeader) => {
            const checkHeader = supportedHeader + ':';

            if (header.indexOf(checkHeader) >= 0) {
              headers[supportedHeader] = header.slice(checkHeader.length + 1);
            }
          });
        });

      if (!headers.id || !headers.Location || this.devices.has(headers.id)) {
        return;
      }

      const parsedUrl = url.parse(headers.Location);
      const device = new YeelightDeviceController({
        id: headers.id,
        model: headers.model,
        version: headers.fw_ver,
        support: headers.support?.split(' '),
        location: headers.Location,
        host: String(parsedUrl.hostname),
        port: Number(parsedUrl.port),
      });

      this.devices.set(device.getId(), device);
      this.emit(YeelightDiscoveryEvents.DISCOVER_DEVICE, device);

      device.on(YeelightDeviceEvents.CONNECT, () => {
        this.emit(YeelightDiscoveryEvents.CONNECT_DEVICE, device);
      });

      device.on(YeelightDeviceEvents.DISCONNECT, (deviceError) => {
        this.devices.delete(device.getId());
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

      void device.connect().catch((deviceError) => {
        this.emit(YeelightDiscoveryEvents.DEVICE_ERROR, device, deviceError);
      });
    });

    try {
      socket.bind(MULTICAST_PORT, () => {
        if (this.socket === socket) {
          socket.setBroadcast(true);
        }
      });
    } catch (error) {
      void this.deactivate(error);
    }
  }

  public async deactivate(error?: any): Promise<void> {
    const socket = this.socket;
    const devices = Array.from(this.devices.values());
    this.socket = null;
    this.devices.clear();

    await Promise.all(devices.map((device) => device.close(error instanceof Error ? error : undefined)));

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

  public command(command: YeelightCommand): Promise<any[]> {
    const promises: any[] = [];

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
}
