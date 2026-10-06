export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function wrapIndex(value: number, length: number): number {
  return ((value % length) + length) % length;
}

export function randSign(): 1 | -1 {
  return Math.random() < 0.5 ? -1 : 1;
}
