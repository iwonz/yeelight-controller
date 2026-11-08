const assert = require('node:assert/strict');
const test = require('node:test');

const { YeelightFlowExpressionMode, getFlowExpression } = require('../dist/cjs');

test('the CommonJS build exports the public protocol helpers', () => {
  assert.deepEqual(getFlowExpression(50, YeelightFlowExpressionMode.COLOR, 0, -1), [50, 1, 0, -1]);
});
