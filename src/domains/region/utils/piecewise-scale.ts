/**
 * Maps a value onto evenly spaced ticks whose values are not evenly spaced
 * (e.g. 0, 10, 25, 50, 100, 150 → 0..5). Values past the last tick keep the last
 * segment's slope. The result is in "tick units", ready to use as a bar height.
 */
export function toTickUnits(value: number, ticks: number[]): number {
  if (ticks.length < 2) return value;

  for (let index = 0; index < ticks.length - 1; index += 1) {
    const start = ticks[index];
    const end = ticks[index + 1];
    if (value <= end) {
      return index + Math.max(0, value - start) / (end - start);
    }
  }

  const last = ticks.length - 1;
  return last + (value - ticks[last]) / (ticks[last] - ticks[last - 1]);
}
