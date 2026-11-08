const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const {
  YeelightDevice,
  YeelightDeviceEvents,
  YeelightCommandTimeoutError,
  YeelightConnectionClosedError,
  YeelightMethod,
  YeelightNotConnectedError,
  YeelightProtocolError,
} = require('../dist/cjs');
const { createFakeYeelight, sendMessage } = require('./support/fake-yeelight');

const withTimeout = (promise, timeout = 250) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout);
    }),
  ]);

const connectDevice = async (onCommand, options) => {
  const server = await createFakeYeelight((command, socket, commands) => {
    if (command.method === YeelightMethod.GET_PROP) {
      sendMessage(socket, {
        id: command.id,
        result: command.params.map(() => ''),
      });
      return;
    }

    return onCommand(command, socket, commands);
  });
  const device = new YeelightDevice({ host: server.host, port: server.port }, options);
  const connected = once(device, YeelightDeviceEvents.CONNECT);
  device.connect();
  await withTimeout(connected);

  return {
    device,
    server,
    async close() {
      device.disconnect();
      await server.close();
    },
  };
};

test('parses a response split across TCP chunks', async (t) => {
  const fixture = await connectDevice((command, socket) => {
    const response = `${JSON.stringify({ id: command.id, result: ['ok'] })}\r\n`;
    const splitAt = Math.floor(response.length / 2);
    socket.write(response.slice(0, splitAt));
    setTimeout(() => socket.write(response.slice(splitAt)), 10);
  });
  t.after(() => fixture.close());

  const result = await withTimeout(
    fixture.device.command({ method: YeelightMethod.TOGGLE, params: [] }),
  );

  assert.deepEqual(result, ['ok']);
});

test('parses multiple responses in one TCP chunk', async (t) => {
  const pending = [];
  const fixture = await connectDevice((command, socket) => {
    pending.push(command);
    if (pending.length === 2) {
      socket.write(
        pending
          .map((item) => JSON.stringify({ id: item.id, result: ['ok'] }))
          .join('\r\n') + '\r\n',
      );
    }
  });
  t.after(() => fixture.close());

  const results = await withTimeout(
    Promise.all([
      fixture.device.command({ method: YeelightMethod.TOGGLE, params: [] }),
      fixture.device.command({ method: YeelightMethod.TOGGLE, params: [] }),
    ]),
  );

  assert.deepEqual(results, [['ok'], ['ok']]);
});

test('rejects command promises with device error details', async (t) => {
  const fixture = await connectDevice((command, socket) => {
    sendMessage(socket, {
      id: command.id,
      error: { code: -1, message: 'unsupported method' },
    });
  });
  t.after(() => fixture.close());

  await assert.rejects(
    withTimeout(fixture.device.command({ method: YeelightMethod.TOGGLE, params: [] })),
    (error) => {
      assert.ok(error instanceof YeelightProtocolError);
      assert.equal(error.code, -1);
      assert.equal(error.message, 'unsupported method');
      assert.equal(error.commandId, 2);
      return true;
    },
  );
});

test('rejects commands issued before the socket is connected', async () => {
  const device = new YeelightDevice({ host: '127.0.0.1', port: 55443 });

  await assert.rejects(
    withTimeout(device.command({ method: YeelightMethod.TOGGLE, params: [] })),
    (error) => {
      assert.ok(error instanceof YeelightNotConnectedError);
      return true;
    },
  );
});

test('rejects commands that exceed their response timeout', async (t) => {
  const fixture = await connectDevice(() => undefined, { commandTimeout: 25 });
  t.after(() => fixture.close());

  await assert.rejects(
    withTimeout(fixture.device.command({ method: YeelightMethod.TOGGLE, params: [] })),
    (error) => {
      assert.ok(error instanceof YeelightCommandTimeoutError);
      assert.equal(error.commandId, 2);
      assert.equal(error.method, YeelightMethod.TOGGLE);
      assert.equal(error.timeout, 25);
      return true;
    },
  );
});

test('rejects pending commands when the connection closes', async (t) => {
  let receivedCommand;
  const received = new Promise((resolve) => {
    receivedCommand = resolve;
  });
  const fixture = await connectDevice((command) => receivedCommand(command));
  t.after(() => fixture.server.close());

  const pending = fixture.device.command({ method: YeelightMethod.TOGGLE, params: [] });
  await withTimeout(received);
  fixture.device.disconnect(new Error('connection lost'));

  await assert.rejects(withTimeout(pending), (error) => {
    assert.ok(error instanceof YeelightConnectionClosedError);
    assert.equal(error.cause.message, 'connection lost');
    return true;
  });
});
