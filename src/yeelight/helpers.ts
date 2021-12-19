import { clamp } from '../utils';
import { YeelightFlowExpression, YeelightFlowExpressionMode } from './types';

export const getFlowExpression = (
  duration: number,
  mode: YeelightFlowExpressionMode,
  value: number,
  brightness: number,
): YeelightFlowExpression => {
  if (mode === YeelightFlowExpressionMode.COLOR) {
    value = clamp(value, 0, 16777215);
  } else if (mode === YeelightFlowExpressionMode.COLOR_TEMPERATURE) {
    value = clamp(value, 1700, 6500);
  }

  return [clamp(duration, 50), mode, value, brightness === -1 ? -1 : clamp(duration, 1, 100)];
};
