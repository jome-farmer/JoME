import { describe as group, expect, it } from "vitest";
import { describe, forecastUrl, parseForecast, roundPlace } from "./weather";

const sample = {
  current: { temperature_2m: 24.3, weather_code: 2, is_day: 1 },
  daily: {
    time: ["2026-10-01", "2026-10-02"],
    weather_code: [2, 61],
    temperature_2m_max: [29.1, 25],
    temperature_2m_min: [17.4, 16],
    precipitation_probability_max: [10, null],
  },
};

group("parseForecast", () => {
  it("reads now and each day", () => {
    const w = parseForecast(sample);
    expect(w.now).toEqual({ tempC: 24.3, code: 2, isDay: true });
    expect(w.days).toEqual([
      { date: "2026-10-01", code: 2, maxC: 29.1, minC: 17.4, rainPct: 10 },
      { date: "2026-10-02", code: 61, maxC: 25, minC: 16, rainPct: null },
    ]);
  });

  it("refuses a response without current weather or days", () => {
    expect(() => parseForecast({})).toThrow();
    expect(() => parseForecast({ ...sample, daily: { time: [] } })).toThrow();
    expect(() => parseForecast(null)).toThrow();
  });
});

group("describe", () => {
  it.each([
    [0, "clear", "Clear"],
    [2, "partly", "Partly cloudy"],
    [3, "cloudy", "Cloudy"],
    [45, "fog", "Fog"],
    [53, "drizzle", "Drizzle"],
    [63, "rain", "Rain"],
    [81, "rain", "Rain"],
    [73, "snow", "Snow"],
    [95, "storm", "Thunderstorm"],
    [42, "cloudy", "Cloudy"],
  ])("%i → %s", (code, sky, label) =>
    expect(describe(code)).toEqual({ sky, label }),
  );
});

group("location privacy", () => {
  it("rounds to about 1 km before it leaves the phone", () => {
    expect(roundPlace({ lat: 35.699712, lon: 51.337981 })).toEqual({
      lat: 35.7,
      lon: 51.34,
    });
    const url = new URL(forecastUrl({ lat: 35.699712, lon: 51.337981 }));
    expect(url.searchParams.get("latitude")).toBe("35.7");
    expect(url.searchParams.get("longitude")).toBe("51.34");
  });
});
