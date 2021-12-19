# Yeelight Controller

Unlike analogs, it is typed using TypeScript, includes automatic validation of input parameters and implements absolutely all methods from the official documentation from Yeelight (including methods for working with the background).

🔫 Library for using Yeelight WiFi Light Inter-Operation Specification.

🤘 Writing with TypeScript.

☝ Support all methods (including bg manipulation).

☝ Auto validate all parameters to.

☝ Have some helpful utility methods (`getFlowExpression` etc.).

Official Yeelight documentation - https://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf

Don't forget enable `LAN Manipulation` toggle on Yeelight Official App.

## Installation
```bash
yarn add @iwonz/yeelight-controller
```
or
```bash
npm install @iwonz/yeelight-controller
```

## Usage with Discover Api
As you may know, Yeelight use SSDP (https://datatracker.ietf.org/doc/html/draft-cai-ssdp-v1-03) for local discovery devices.
Library allow you manage all your smart device easily. You can collect all devices and manipulate with them easy.
```javascript
import { YeelightDiscovery } from '@iwonz/yeelight-controller';

const discovery = new YeelightDiscovery();

// You want to wait before do manipulation with devices
// Need time to do all handshakes and connect with all devices
setTimeout(() => {
  discovery.getDevices().forEach((device) => {
    void device.toggle();
  });
}, 1000);

discovery.activate();
```
`discovery.activate();` automatically find all available devices.

And you can subscribe to events for getting info.
```javascript
import { YeelightDiscovery, YeelightDiscoveryEvents } from '@iwonz/yeelight-controller';

const discovery = new YeelightDiscovery();

discovery.on(YeelightDiscoveryEvents.DISCONNECT, (error) => {
    // Error may be null
    // Called then YeelightDiscover was disconnected. After error or if you call `discovery.deactivate();`
});

discovery.on(YeelightDiscoveryEvents.DISCOVER_DEVICE, (device) => {
    // Called then YeelightDiscover discover device
    // Discover doest not mean connect. More on this later.
});

discovery.on(YeelightDiscoveryEvents.CONNECT_DEVICE, (device) => {
    // Called then YeelightDiscover connect to device
    // It's mean that you can to do manipulation with device (execute commands)
});

discovery.on(YeelightDiscoveryEvents.DISCONNECT_DEVICE, (device) => {
    // Called then device was disconnected
    // After disconnect device will be automatically removedd from devices list
    // It's mean that you can not do manipulation with device (execute commands)
});

discovery.on(YeelightDiscoveryEvents.DEVICE_CHANGE_PROPS, (device, props) => {
    // Called then props was changed on device
});

discovery.on(YeelightDiscoveryEvents.DEVICE_DATA, (device, data) => {
    // Allow you to get all parsed data from device socket
});

discovery.on(YeelightDiscoveryEvents.DEVICE_ERROR, (device, error) => {
    // Allow you to get errors from device socket
});

discovery.activate();
```
You can also get device by id
```javascript
import { YeelightDiscovery } from '@iwonz/yeelight-controller';

const discovery = new YeelightDiscovery();

// You want to wait before do manipulation with devices
// Need time to do all handshakes and connect with all devices
setTimeout(() => {
  const device = discovery.getDeviceById('DEVICE_ID');
  void device?.toggle();
}, 1000);

discovery.activate();
```
Or by name
```javascript
import { YeelightDiscovery } from '@iwonz/yeelight-controller';

const discovery = new YeelightDiscovery();

// You want to wait before do manipulation with devices
// Need time to do all handshakes and connect with all devices
setTimeout(() => {
  const device = discovery.getDeviceByName('DEVICE_NAME');
  void device?.toggle();
}, 1000);

discovery.activate();
```

## Usage without Discover Api
If you can find and control device directly.
```javascript
import { YeelightDevice, YeelightDeviceEvents } from '@iwonz/yeelight-controller';

const device = new YeelightDevice({
  host: 'DEVICE_HOST',
  port: 'DEVICE_PORT',
});

device.on(YeelightDeviceEvents.CONNECT, () => {
  void device.toggle();
});

device.connect();
```

Also you can subscribe to events.
```javascript
import { YeelightDevice, YeelightDeviceEvents } from '@iwonz/yeelight-controller';

const device = new YeelightDevice({
  host: 'DEVICE_HOST',
  port: 'DEVICE_PORT',
});

discovery.on(YeelightDeviceEvents.CONNECT, () => {
  // Here you can manipulate with device
});

discovery.on(YeelightDeviceEvents.DISCONNECT, (error) => {
  // error can be null
  // Called then device disconnected
});

discovery.on(YeelightDeviceEvents.PROPS_CHANGE, (props) => {
  // Called then device change props
});

discovery.on(YeelightDeviceEvents.DEVICE_DATA, (data) => {
  // Allow you to get all parsed data from device socket
});

discovery.on(YeelightDeviceEvents.DEVICE_ERROR, (error) => {
  // Allow you to get errors from device socket
});

device.connect();
```
Call `device.disconnect();` if you want to disconnect device.

Like on discover YeelightDevice get you wrapper functions to all official commands and automatically clamp parameters.
