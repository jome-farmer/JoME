import type { Place } from "../../lib/storage";

/** Current conditions and the coming days at the garden (Open-Meteo, WMO weather codes). */
export type Weather = {
  now: { tempC: number; code: number; isDay: boolean };
  /** Today first. */
  days: {
    date: string;
    code: number;
    maxC: number;
    minC: number;
    /** Highest chance of rain that day, 0–100; null when the model has none. */
    rainPct: number | null;
  }[];
};

export type Sky =
  "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** Two decimals is about 1 km: enough for weather, and no closer to the house. */
export const roundPlace = (p: Place): Place => ({
  lat: Math.round(p.lat * 100) / 100,
  lon: Math.round(p.lon * 100) / 100,
});

export function forecastUrl(place: Place): string {
  const { lat, lon } = roundPlace(place);
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,weather_code,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "6",
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

type Raw = {
  current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: (number | null)[];
  };
};

/** Throws on a response it can't use rather than showing made-up weather. */
export function parseForecast(json: unknown): Weather {
  const { current: c, daily: d } = (json ?? {}) as Raw;
  if (
    typeof c?.temperature_2m !== "number" ||
    typeof c.weather_code !== "number" ||
    !d?.time?.length
  )
    throw new Error("Unexpected weather response");
  return {
    now: {
      tempC: c.temperature_2m,
      code: c.weather_code,
      isDay: c.is_day !== 0,
    },
    days: d.time.map((date, i) => ({
      date,
      code: d.weather_code?.[i] ?? 0,
      maxC: d.temperature_2m_max?.[i] ?? NaN,
      minC: d.temperature_2m_min?.[i] ?? NaN,
      rainPct: d.precipitation_probability_max?.[i] ?? null,
    })),
  };
}

/** WMO weather code → sky and the words people see. */
export function describe(code: number): { sky: Sky; label: string } {
  if (code === 0) return { sky: "clear", label: "Clear" };
  if (code === 1) return { sky: "clear", label: "Mostly clear" };
  if (code === 2) return { sky: "partly", label: "Partly cloudy" };
  if (code === 3) return { sky: "cloudy", label: "Cloudy" };
  if (code === 45 || code === 48) return { sky: "fog", label: "Fog" };
  if (code >= 51 && code <= 57) return { sky: "drizzle", label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { sky: "rain", label: "Rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { sky: "snow", label: "Snow" };
  if (code >= 95) return { sky: "storm", label: "Thunderstorm" };
  return { sky: "cloudy", label: "Cloudy" };
}

const FRESH_MS = 30 * 60_000;
const cache = new Map<string, { at: number; weather: Weather }>();

/** Fetches at most every 30 minutes per place (this session only). */
export async function getWeather(place: Place): Promise<Weather> {
  const url = forecastUrl(place);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.weather;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Weather service answered ${res.status}`);
  const weather = parseForecast(await res.json());
  cache.set(url, { at: Date.now(), weather });
  return weather;
}
