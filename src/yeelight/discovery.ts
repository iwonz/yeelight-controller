import EventEmitter from 'events';
import dgram from 'dgram';
import url from 'url';
import { YeelightCommand, YeelightDeviceEvents, YeelightDiscoveryEvents } from './types';
import { YeelightDeviceController } from './device-controller';

const MULTICAST_IP = '239.255.255.250';
const MULTICAST_PORT = 1982;

export class YeelightDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private devices: Map<string, YeelightDeviceController> = new Map();

  constructor() {
    super();

    this.socket = dgram.createSocket('udp4');
  }

  public activate(): void {
    this.socket?.on('listening', () => {
      this.socket?.addMembership(MULTICAST_IP);

      const buffer = Buffer.from('M-SEARCH * HTTP/1.1\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n');

      this.socket?.send(buffer, 0, buffer.length, MULTICAST_PORT, MULTICAST_IP);
    });

    this.socket?.on('message', (deviceInfo: string) => {
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

      device.on(YeelightDeviceEvents.DISCONNECT, (error) => {
        this.devices.delete(device.getId());

        this.emit(YeelightDiscoveryEvents.DISCONNECT_DEVICE, device, error);
      });

      device.on(YeelightDeviceEvents.PROPS_CHANGE, (props) => {
        this.emit(YeelightDiscoveryEvents.DEVICE_CHANGE_PROPS, device, props);
      });

      device.on(YeelightDeviceEvents.DATA, (data) => {
        this.emit(YeelightDiscoveryEvents.DEVICE_DATA, device, data);
      });

      device.on(YeelightDeviceEvents.ERROR, (error) => {
        this.emit(YeelightDiscoveryEvents.DEVICE_ERROR, device, error);
      });

      device.connect();
    });

    try {
      this.socket?.bind(MULTICAST_PORT, () => {
        this.socket?.setBroadcast(true);
      });
    } catch (error) {
      this.deactivate(error);
    }
  }

  public deactivate(error?: any): void {
    this.socket?.disconnect();
    this.socket = null;

    this.emit(YeelightDiscoveryEvents.DISCONNECT, error);
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
