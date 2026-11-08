const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const {
  YeelightDevice,
  YeelightDeviceEvents,
  YeelightCommandTimeoutError,
  YeelightConnectionClosedError,
  YeelightDuplicateCommandIdError,
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

test('preserves command id zero when correlating a response', async (t) => {
  let receivedId;
  const fixture = await connectDevice((command, socket) => {
    receivedId = command.id;
    sendMessage(socket, { id: command.id, result: ['ok'] });
  }, { commandTimeout: 30 });
  t.after(() => fixture.close());

  const result = await withTimeout(
    fixture.device.command({ id: 0, method: YeelightMethod.TOGGLE, params: [] }),
  );

  assert.equal(receivedId, 0);
  assert.deepEqual(result, ['ok']);
});

test('replaces an explicitly undefined command id', async (t) => {
  let receivedId;
  const fixture = await connectDevice((command, socket) => {
    receivedId = command.id;
    sendMessage(socket, { id: command.id, result: ['ok'] });
  }, { commandTimeout: 30 });
  t.after(() => fixture.close());

  const result = await withTimeout(
    fixture.device.command({ id: undefined, method: YeelightMethod.TOGGLE, params: [] }),
  );

  assert.equal(typeof receivedId, 'number');
  assert.deepEqual(result, ['ok']);
});

test('rejects duplicate active command ids without replacing the first command', async (t) => {
  let firstSocket;
  let receivedFirst;
  const firstReceived = new Promise((resolve) => {
    receivedFirst = resolve;
  });
  const fixture = await connectDevice((command, socket) => {
    firstSocket = socket;
    receivedFirst();
  }, { commandTimeout: 100 });
  t.after(() => fixture.close());

  const first = fixture.device.command({ id: 99, method: YeelightMethod.TOGGLE, params: [] });
  await withTimeout(firstReceived);
  const duplicate = fixture.device.command({ id: 99, method: YeelightMethod.TOGGLE, params: [] });

  await assert.rejects(duplicate, (error) => {
    assert.ok(error instanceof YeelightDuplicateCommandIdError);
    assert.equal(error.commandId, 99);
    return true;
  });

  sendMessage(firstSocket, { id: 99, result: ['ok'] });
  assert.deepEqual(await withTimeout(first), ['ok']);
});
