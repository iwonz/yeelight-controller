import {
  YeelightDevice,
  YeelightDeviceEvents,
  YeelightDiscovery,
  YeelightDiscoveryEvents,
  YeelightMethod,
  YeelightProps,
  type YeelightResponseSuccess,
} from '../src';

const device = new YeelightDevice({ host: '127.0.0.1', port: 55443 });
const toggleResult: Promise<YeelightResponseSuccess> = device.command({
  method: YeelightMethod.TOGGLE,
  params: [],
});
const propResult: Promise<string[]> = device.command({
  method: YeelightMethod.GET_PROP,
  params: [YeelightProps.POWER],
});
const futureResult: Promise<{ value: number }> = device.rawCommand<{ value: number }>('future_method', [1]);

device.on(YeelightDeviceEvents.CONNECT, () => undefined);
device.on(YeelightDeviceEvents.PROPS_CHANGE, (props) => props.name);
// @ts-expect-error CONNECT listeners do not receive a string argument.
device.on(YeelightDeviceEvents.CONNECT, (_unexpected: string) => undefined);

const snapshot = device.getProperties();
// @ts-expect-error Property snapshots are immutable.
snapshot.name = 'changed';

const discovery = new YeelightDiscovery();
discovery.on(YeelightDiscoveryEvents.DISCOVER_DEVICE, (foundDevice) => foundDevice.toggle());
// @ts-expect-error Discovery ERROR listeners receive Error, not string.
discovery.on(YeelightDiscoveryEvents.ERROR, (_error: string) => undefined);

void toggleResult;
void propResult;
void futureResult;
