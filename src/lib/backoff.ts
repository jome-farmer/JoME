const DELAYS_MS = [1_000, 2_000, 5_000];
const STEADY_MS = 10_000;

/** Wait before reconnect attempt `n` (0-based): 1 s, 2 s, 5 s, then every 10 s. */
export function reconnectDelay(attempt: number): number {
  return DELAYS_MS[attempt] ?? STEADY_MS;
}
