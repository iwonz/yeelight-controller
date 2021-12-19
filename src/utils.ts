export const clamp = (value: number, min = Number.MIN_SAFE_INTEGER, max: number = Number.MAX_SAFE_INTEGER): number => {
  return Math.min(Math.max(value, min), max);
};
