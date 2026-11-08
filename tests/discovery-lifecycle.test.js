const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { once } = require('node:events');
const test = require('node:test');

const { YeelightDiscovery, YeelightDiscoveryEvents } = require('../dist/cjs');

const withTimeout = (promise, timeout = 250) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout);
    }),
  ]);

class FakeDatagramSocket extends EventEmitter {
  constructor(options = {}) {
    super();
    this.closed = false;
    this.options = options;
  }

  addMembership() {
    if (this.options.membershipError) {
      throw this.options.membershipError;
    }
  }

  bind() {
    if (this.options.bindError) {
      throw this.options.bindError;
    }
    queueMicrotask(() => this.emit('listening'));
  }

  close(callback) {
    this.closed = true;
    queueMicrotask(() => callback?.());
  }

  send(...args) {
    const callback = args.at(-1);
    if (this.options.sendError && typeof callback === 'function') {
      queueMicrotask(() => callback(this.options.sendError));
    }
  }

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
  assert.equal(
    sockets.every((socket) => socket.closed),
    true,
  );
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

test('asynchronous UDP errors are emitted and close discovery', async () => {
  const socket = new FakeDatagramSocket();
  const discovery = new YeelightDiscovery({ socketFactory: () => socket });
  const expectedError = new Error('udp failed');
  const failed = once(discovery, YeelightDiscoveryEvents.ERROR);
  const disconnected = once(discovery, YeelightDiscoveryEvents.DISCONNECT);

  discovery.activate();
  socket.emit('error', expectedError);

  assert.equal((await withTimeout(failed))[0], expectedError);
  assert.equal((await withTimeout(disconnected))[0], expectedError);
  assert.equal(socket.closed, true);
});

test('membership and send failures use the same discovery error path', async () => {
  for (const socket of [
    new FakeDatagramSocket({ membershipError: new Error('membership failed') }),
    new FakeDatagramSocket({ sendError: new Error('send failed') }),
  ]) {
    const discovery = new YeelightDiscovery({ socketFactory: () => socket });
    const failed = once(discovery, YeelightDiscoveryEvents.ERROR);
    const disconnected = once(discovery, YeelightDiscoveryEvents.DISCONNECT);

    discovery.activate();

    const [error] = await withTimeout(failed);
    await withTimeout(disconnected);
    assert.match(error.message, /failed/);
    assert.equal(socket.closed, true);
  }
});
