const assert = require('node:assert/strict');
const test = require('node:test');

const { YeelightDeviceController, YeelightMethod, YeelightMusicAction, YeelightProps } = require('../dist/cjs');
const { createFakeYeelight, sendMessage } = require('./support/fake-yeelight');

const connectController = async (onCommand, options) => {
  let initialized = false;
  const server = await createFakeYeelight((command, socket) => {
    if (!initialized && command.method === YeelightMethod.GET_PROP) {
      initialized = true;
      sendMessage(socket, { id: command.id, result: command.params.map(() => '') });
      return;
    }

    const result = onCommand(command) ?? ['ok'];
    sendMessage(socket, { id: command.id, result });
  });
  const device = new YeelightDeviceController({ host: server.host, port: server.port }, options);
  await device.connect();

  return {
    device,
    async close() {
      await device.close();
      await server.close();
    },
  };
};

test('serializes the auto-delay scene class with the protocol spelling', async (t) => {
  let sentCommand;
  const fixture = await connectController((command) => {
    sentCommand = command;
  });
  t.after(() => fixture.close());

  await fixture.device.setSceneAutoDelayOff(50, 5);

  assert.deepEqual(sentCommand.params, ['auto_delay_off', 50, 5]);
});

test('maps getProps results to their requested property names', async (t) => {
  const fixture = await connectController((command) => {
    if (command.method === YeelightMethod.GET_PROP) {
      return ['on', '42'];
    }
    return undefined;
  });
  t.after(() => fixture.close());

  const props = await fixture.device.getProps([YeelightProps.POWER, YeelightProps.BRIGHT]);
  const values = await fixture.device.getPropValues([YeelightProps.POWER, YeelightProps.BRIGHT]);

  assert.deepEqual(props, { power: 'on', bright: '42' });
  assert.deepEqual(values, ['on', '42']);
});

test('serializes music mode enable and disable with action-specific parameters', async (t) => {
  const commands = [];
  const fixture = await connectController((command) => {
    commands.push(command);
    return undefined;
  });
  t.after(() => fixture.close());

  await fixture.device.enableMusic('192.168.1.50', 54321);
  await fixture.device.disableMusic();
  await fixture.device.setMusic(YeelightMusicAction.TURN_OFF);

  assert.deepEqual(
    commands.map((command) => command.params),
    [[1, '192.168.1.50', 54321], [0], [0]],
  );
});

test('music mode bypasses the normal command quota', async (t) => {
  const receivedAt = [];
  const fixture = await connectController(
    (command) => {
      receivedAt.push({ method: command.method, time: Date.now() });
      return undefined;
    },
    { maxCommandsPerWindow: 2, rateLimitWindow: 100 },
  );
  t.after(() => fixture.close());

  await fixture.device.enableMusic('192.168.1.50', 54321);
  await Promise.all([fixture.device.toggle(), fixture.device.toggle(), fixture.device.toggle()]);
  await fixture.device.disableMusic();

  const toggles = receivedAt.filter((entry) => entry.method === YeelightMethod.TOGGLE);
  assert.equal(toggles.length, 3);
  assert.ok(toggles.at(-1).time - toggles[0].time < 50);
});
