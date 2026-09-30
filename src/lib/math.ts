export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Share of a run still to go, 0…1. A zero or negative total counts as done. */
export function remainingFraction(remaining: number, total: number): number {
  return total > 0 ? clamp(remaining / total, 0, 1) : 0;
}
