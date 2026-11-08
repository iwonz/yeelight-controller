const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getFlowExpression,
  YeelightAdjustAction,
  YeelightAdjustProp,
  YeelightColorFlowAction,
  YeelightDeviceController,
  YeelightEffect,
  YeelightFlowExpressionMode,
  YeelightValidationError,
} = require('../dist/cjs');

const createDevice = () => new YeelightDeviceController({ host: '127.0.0.1', port: 55443 });

const rejectsValidation = async (operation, field) => {
  await assert.rejects(Promise.resolve().then(operation), (error) => {
    assert.ok(error instanceof YeelightValidationError);
    assert.equal(error.field, field);
    return true;
  });
};

test('rejects non-finite and fractional protocol integers', async () => {
  const device = createDevice();

  await rejectsValidation(() => device.setBright(Number.NaN, YeelightEffect.SUDDEN, 30), 'brightness');
  await rejectsValidation(() => device.setBright(50.5, YeelightEffect.SUDDEN, 30), 'brightness');
  await rejectsValidation(() => getFlowExpression(50.5, YeelightFlowExpressionMode.COLOR, 255, 20), 'duration');
});

test('rejects semantic color-adjustment and flow errors', async () => {
  const device = createDevice();

  await rejectsValidation(() => device.setAdjust(YeelightAdjustAction.INCREASE, YeelightAdjustProp.COLOR), 'action');
  await rejectsValidation(
    () => device.startCf(-1, YeelightColorFlowAction.RECOVER, [[50, 1, 255, 20]], false),
    'count',
  );
  await rejectsValidation(() => device.startCf(1, YeelightColorFlowAction.RECOVER, [], false), 'flowExpression');
});

test('rejects invalid music endpoints and names longer than 64 bytes', async () => {
  const device = createDevice();

  await rejectsValidation(() => device.enableMusic('', 54321), 'host');
  await rejectsValidation(() => device.enableMusic('192.168.1.50', 70000), 'port');
  await rejectsValidation(() => device.setName('😀'.repeat(17)), 'name');
});

test('rejects non-positive command quota options', async () => {
  await rejectsValidation(
    () => new YeelightDeviceController({ host: '127.0.0.1', port: 55443 }, { maxCommandsPerWindow: 0 }),
    'maxCommandsPerWindow',
  );
  await rejectsValidation(
    () => new YeelightDeviceController({ host: '127.0.0.1', port: 55443 }, { rateLimitWindow: 0 }),
    'rateLimitWindow',
  );
});
