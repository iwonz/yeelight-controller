const assert = require('node:assert/strict');
const test = require('node:test');

const {
  YeelightDeviceController,
  YeelightMethod,
} = require('../dist/cjs');
const { createFakeYeelight, sendMessage } = require('./support/fake-yeelight');

const connectController = async (onCommand) => {
  const server = await createFakeYeelight((command, socket) => {
    if (command.method === YeelightMethod.GET_PROP) {
      sendMessage(socket, { id: command.id, result: command.params.map(() => '') });
      return;
    }

    onCommand(command);
    sendMessage(socket, { id: command.id, result: ['ok'] });
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
