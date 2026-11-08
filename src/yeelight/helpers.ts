import { YeelightFlowExpression, YeelightFlowExpressionMode } from './types';
import { clampProtocolInteger } from './validation';

export const getFlowExpression = (
  duration: number,
  mode: YeelightFlowExpressionMode,
  value: number,
  brightness: number,
): YeelightFlowExpression => {
  duration = clampProtocolInteger(duration, 'duration', 50);
  if (mode === YeelightFlowExpressionMode.COLOR) {
    value = clampProtocolInteger(value, 'value', 0, 16777215);
  } else if (mode === YeelightFlowExpressionMode.COLOR_TEMPERATURE) {
    value = clampProtocolInteger(value, 'value', 1700, 6500);
  } else {
    value = clampProtocolInteger(value, 'value');
  }

  return [duration, mode, value, brightness === -1 ? -1 : clampProtocolInteger(brightness, 'brightness', 1, 100)];
};
