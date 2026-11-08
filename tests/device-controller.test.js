const assert = require('node:assert/strict');
const test = require('node:test');

const {
  YeelightDeviceController,
  YeelightMethod,
  YeelightProps,
} = require('../dist/cjs');
const { createFakeYeelight, sendMessage } = require('./support/fake-yeelight');

const connectController = async (onCommand) => {
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
  const device = new YeelightDeviceController({ host: server.host, port: server.port });
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
