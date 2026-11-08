import { clamp } from '../utils';
import { YeelightValidationError } from './errors';
import { YeelightFlowExpression, YeelightFlowExpressionMode } from './types';

export const requireProtocolInteger = (
  value: number,
  field: string,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new YeelightValidationError(field, 'must be a finite integer');
  }
  if (value < min || value > max) {
    throw new YeelightValidationError(field, `must be between ${min} and ${max}`);
  }
  return value;
};

export const clampProtocolInteger = (
  value: number,
  field: string,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new YeelightValidationError(field, 'must be a finite integer');
  }
  return clamp(value, min, max);
};

export const requireNonEmptyString = (value: string | undefined, field: string): string => {
  if (!value || value.trim().length === 0) {
    throw new YeelightValidationError(field, 'must be a non-empty string');
  }
  return value;
};

export const requireByteLength = (value: string, field: string, maxBytes: number): string => {
  if (Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new YeelightValidationError(field, `must not exceed ${maxBytes} UTF-8 bytes`);
  }
  return value;
};

export const validateFlowExpression = (flowExpression: YeelightFlowExpression[]): void => {
  if (flowExpression.length === 0) {
    throw new YeelightValidationError('flowExpression', 'must contain at least one tuple');
  }

  flowExpression.forEach(([duration, mode, value, brightness], index) => {
    requireProtocolInteger(duration, `flowExpression[${index}].duration`, 50);
    requireProtocolInteger(mode, `flowExpression[${index}].mode`);
    if (
      ![
        YeelightFlowExpressionMode.COLOR,
        YeelightFlowExpressionMode.COLOR_TEMPERATURE,
        YeelightFlowExpressionMode.SLEEP,
      ].includes(mode)
    ) {
      throw new YeelightValidationError(`flowExpression[${index}].mode`, 'must be 1, 2, or 7');
    }
    requireProtocolInteger(value, `flowExpression[${index}].value`);
    if (brightness !== -1) {
      requireProtocolInteger(brightness, `flowExpression[${index}].brightness`, 1, 100);
    }
  });
};
