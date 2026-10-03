import type { Place } from "./storage";

/** A zone outline: its corners in order, [lat, lon] in degrees. */
export type Shape = [number, number][];

/** The phone's rough position. Rejects with GeolocationPositionError (code 1 = denied). */
export function phonePlace(): Promise<Place> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
    ),
  );
}

const R = 6_371_008.8; // mean Earth radius, m
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Area of a zone outline in m². Corners are projected flat around their own
 * middle, which is well under 1% off for anything garden-sized.
 */
export function shapeArea(shape: Shape): number {
  if (shape.length < 3) return 0;
  const lat0 = rad(shape.reduce((a, [lat]) => a + lat, 0) / shape.length);
  const xy = shape.map(([lat, lon]) => [
    R * rad(lon) * Math.cos(lat0),
    R * rad(lat),
  ]);
  let twice = 0;
  xy.forEach(([x1, y1], i) => {
    const [x2, y2] = xy[(i + 1) % xy.length];
    twice += x1 * y2 - x2 * y1;
  });
  return Math.abs(twice) / 2;
}
