const assert = require('node:assert/strict');
const test = require('node:test');

const {
  YeelightDevice,
  YeelightDeviceController,
} = require('../dist/cjs');

test('YeelightDevice is the full controller and keeps the old controller alias', () => {
  const device = new YeelightDevice({ host: '127.0.0.1', port: 55443 });

  assert.equal(typeof device.toggle, 'function');
  assert.equal(typeof device.setRgb, 'function');
  assert.equal(YeelightDeviceController, YeelightDevice);
});
