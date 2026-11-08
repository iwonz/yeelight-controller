# Yeelight Controller

Typed Node.js client for the [Yeelight WiFi LAN protocol](https://www.yeelight.com/download/Yeelight_Inter-Operation_Spec.pdf). It discovers and controls devices on the local network, validates protocol parameters, exposes typed events and command results, and supports both the main and background lights.

Enable **LAN Control** for each light in the official Yeelight app before using this library.

See [CHANGELOG.md](CHANGELOG.md) for release and migration notes.

## Installation

```bash
npm install @iwonz/yeelight-controller
```

```bash
yarn add @iwonz/yeelight-controller
```

## Direct connection

`connect()` resolves after the TCP connection is ready and the initial device properties have been loaded.

```typescript
import {
  YeelightDevice,
  YeelightEffect,
  YeelightPower,
  YeelightProps,
} from '@iwonz/yeelight-controller';

const device = new YeelightDevice(
  { host: '192.168.1.50', port: 55443 },
  { commandTimeout: 5_000 },
);

try {
  await device.connect();
  await device.setPower(YeelightPower.ON, YeelightEffect.SMOOTH, 500);
  await device.setRgb(0xff0000, YeelightEffect.SMOOTH, 500);

  const props = await device.getProps([YeelightProps.POWER, YeelightProps.BRIGHT]);
  console.log(props.power, props.bright);
} finally {
  await device.close();
}
```

`YeelightDeviceController` remains available as an alias of `YeelightDevice` for compatibility.

## Device discovery

Discovery uses Yeelight's SSDP-like multicast protocol. React to `CONNECT_DEVICE` instead of waiting for an arbitrary timeout.

```typescript
import {
  YeelightDiscovery,
  YeelightDiscoveryEvents,
} from '@iwonz/yeelight-controller';

const discovery = new YeelightDiscovery();

discovery.on(YeelightDiscoveryEvents.CONNECT_DEVICE, (device) => {
  void device.toggle().catch((error) => {
    console.error(`Command for ${device.getId()} failed`, error);
  });
});

discovery.on(YeelightDiscoveryEvents.DEVICE_ERROR, (device, error) => {
  console.error(`Device ${device.getId()} failed`, error);
});

discovery.on(YeelightDiscoveryEvents.ERROR, (error) => {
  console.error('Discovery failed', error);
});

discovery.activate();

process.once('SIGINT', () => {
  void discovery.deactivate();
});
```

Call `discovery.rescan()` to send another request while discovery is active. Await `discovery.deactivate()` during application shutdown to close the UDP socket and every managed device.

Connected or previously discovered devices are available through:

```typescript
const devices = discovery.getDevices();
const byId = discovery.getDeviceById('0x0000000000000000');
const byName = discovery.getDeviceByName('Desk light');
```

## Background light

Main-light methods are available directly on the device. Background-light methods are grouped under `device.background`:

```typescript
import { YeelightEffect } from '@iwonz/yeelight-controller';

await device.setRgb(0xff0000, YeelightEffect.SMOOTH, 500);
await device.background.setRgb(0x0000ff, YeelightEffect.SMOOTH, 500);
await device.background.toggle();
```

The older positional `isBg` arguments remain supported, but the background facade is clearer for new code.

## Commands, events, and errors

Known protocol methods have inferred result types:

```typescript
import { YeelightMethod, YeelightProps } from '@iwonz/yeelight-controller';

const values = await device.command({
  method: YeelightMethod.GET_PROP,
  params: [YeelightProps.POWER, YeelightProps.BRIGHT],
}); // string[]

const result = await device.rawCommand<{ value: number }>('future_method', []);
```

Device events are typed through `YeelightDeviceEvents`. Property snapshots returned by `getProperties()` are read-only copies.

Command promises reject when the device returns a protocol error, the response times out, the connection closes, or a duplicate command ID is active. Exported error classes include:

- `YeelightProtocolError`
- `YeelightCommandTimeoutError`
- `YeelightConnectionClosedError`
- `YeelightNotConnectedError`
- `YeelightDuplicateCommandIdError`
- `YeelightValidationError`

## Connection options

The optional second `YeelightDevice` constructor argument accepts:

| Option | Default | Meaning |
| --- | ---: | --- |
| `commandTimeout` | `5000` ms | Maximum wait for a command response. |
| `maxCommandsPerWindow` | `60` | Commands allowed in one rate-limit window. |
| `rateLimitWindow` | `60000` ms | Rate-limit window duration. |

Music mode automatically bypasses the normal command quota while it is enabled.

## Development

Install the locked dependencies and run the complete verification suite:

```bash
yarn install --frozen-lockfile
npm run check
```

Useful commands:

```bash
npm run build
npm test
npm run lint
npm run lint:fix
npm run format
npm run knip
```

## License

[MIT](LICENSE)
