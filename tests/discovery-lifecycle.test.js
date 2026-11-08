const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { YeelightDiscovery } = require('../dist/cjs');

class FakeDatagramSocket extends EventEmitter {
  constructor() {
    super();
    this.closed = false;
  }

  addMembership() {}

  bind() {
    queueMicrotask(() => this.emit('listening'));
  }

  close(callback) {
    this.closed = true;
    queueMicrotask(() => callback?.());
  }

  send() {}

  setBroadcast() {}
}

test('deactivate is safe before discovery has been activated', async () => {
  const discovery = new YeelightDiscovery();

  await assert.doesNotReject(discovery.deactivate());
});

test('discovery creates a fresh UDP socket when reactivated', async () => {
  const sockets = [];
  const discovery = new YeelightDiscovery({
    socketFactory: () => {
      const socket = new FakeDatagramSocket();
      sockets.push(socket);
      return socket;
    },
  });

  discovery.activate();
  await discovery.deactivate();
  discovery.activate();
  await discovery.deactivate();

  assert.equal(sockets.length, 2);
  assert.equal(sockets.every((socket) => socket.closed), true);
});

test('deactivate closes managed devices and clears the registry', async () => {
  let closeCalls = 0;
  const discovery = new YeelightDiscovery({ socketFactory: () => new FakeDatagramSocket() });
  discovery.devices.set('device-id', {
    close: async () => {
      closeCalls += 1;
    },
  });

  discovery.activate();
  await discovery.deactivate();

  assert.equal(closeCalls, 1);
  assert.deepEqual(discovery.getDevices(), []);
});
