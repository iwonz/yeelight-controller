const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { parseYeelightDiscoveryMessage, YeelightDiscovery, YeelightProps } = require('../dist/cjs');

const advertisement = (brightness, location = 'yeelight://10.0.0.8:55443') =>
  Buffer.from(
    [
      'NOTIFY * HTTP/1.1',
      'NTS: ssdp:alive',
      'id: device-id',
      `Location: ${location}`,
      'model: color',
      'fw_ver: 42',
      'support: get_prop set_power toggle',
      'power: on',
      `bright: ${brightness}`,
      'name: desk',
      '',
    ].join('\r\n'),
  );

class FakeDatagramSocket extends EventEmitter {
  constructor() {
    super();
    this.sendCalls = 0;
  }

  addMembership() {}

  bind() {
    queueMicrotask(() => this.emit('listening'));
  }

  close(callback) {
    queueMicrotask(() => callback?.());
  }

  send(...args) {
    this.sendCalls += 1;
    const callback = args.at(-1);
    if (typeof callback === 'function') {
      queueMicrotask(() => callback(null));
    }
  }

  setBroadcast() {}
}

class FakeDevice extends EventEmitter {
  constructor(info, options) {
    super();
    this.info = info;
    this.props = { ...options.initialProps };
    this.connectCalls = 0;
    this.connected = false;
    this.updateCalls = 0;
  }

  async close() {
    this.connected = false;
  }

  command() {
    return Promise.resolve(['ok']);
  }

  async connect() {
    this.connectCalls += 1;
    this.connected = true;
  }

  getId() {
    return this.info.id;
  }

  getName() {
    return this.props.name || '';
  }

  isConnected() {
    return this.connected;
  }

  updateFromDiscovery(info, props) {
    this.updateCalls += 1;
    this.info = info;
    this.props = { ...this.props, ...props };
  }
}

test('discovery parser extracts protocol properties from advertisements', () => {
  const message = parseYeelightDiscoveryMessage(advertisement(35));

  assert.deepEqual(message.props, {
    [YeelightProps.POWER]: 'on',
    [YeelightProps.BRIGHT]: '35',
    [YeelightProps.NAME]: 'desk',
  });
});

test('duplicate advertisements refresh the existing device and reconnect it', async () => {
  const socket = new FakeDatagramSocket();
  const devices = [];
  const discovery = new YeelightDiscovery({
    socketFactory: () => socket,
    deviceFactory: (info, options) => {
      const device = new FakeDevice(info, options);
      devices.push(device);
      return device;
    },
  });

  discovery.activate();
  await new Promise((resolve) => setImmediate(resolve));
  socket.emit('message', advertisement(35));

  assert.equal(devices.length, 1);
  assert.equal(devices[0].props.bright, '35');
  assert.equal(devices[0].connectCalls, 1);

  devices[0].connected = false;
  socket.emit('message', advertisement(60, 'yeelight://10.0.0.9:55443'));

  assert.equal(devices.length, 1);
  assert.equal(devices[0].updateCalls, 1);
  assert.equal(devices[0].props.bright, '60');
  assert.equal(devices[0].info.host, '10.0.0.9');
  assert.equal(devices[0].connectCalls, 2);

  await discovery.deactivate();
});

test('rescan sends another search request through the active socket', async () => {
  const socket = new FakeDatagramSocket();
  const discovery = new YeelightDiscovery({ socketFactory: () => socket });

  discovery.activate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(socket.sendCalls, 1);

  discovery.rescan();
  assert.equal(socket.sendCalls, 2);

  await discovery.deactivate();
});
