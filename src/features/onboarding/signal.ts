/** RSSI in dBm → 1–4 bars (0 = unknown). */
export function signalLevel(rssi?: number): 0 | 1 | 2 | 3 | 4 {
  if (rssi === undefined) return 0;
  if (rssi > -55) return 4;
  if (rssi > -67) return 3;
  if (rssi > -80) return 2;
  return 1;
}
