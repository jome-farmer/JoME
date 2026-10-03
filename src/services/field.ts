/**
 * Sample field data for the parts of the redesign the board can't measure yet:
 * soil probes, zone areas (until an outline is drawn on the map), a weather station, a nutrient doser and rules.
 * Screens label everything from here "Sample". Values are fixed per zone id,
 * so they don't jump between renders.
 *
 * ponytail: static samples; replace each export with a server call once the
 * hardware and DouSHamBE endpoints exist (issues: sensors, map, nutrients).
 */

export type Soil = {
  /** Volumetric water content, % */
  moisture: number;
  /** Electrical conductivity, mS/cm */
  ec: number;
  ph: number;
};

/** "Good", "Low" or "High" for a reading. Status never relies on colour alone. */
export type Level = "Good" | "Low" | "High";

const pick = (zone: number, list: number[]) => list[(zone - 1) % list.length];

export function sampleSoil(zone?: number): Soil {
  if (zone === undefined) return { moisture: 68, ec: 1.8, ph: 6.4 };
  return {
    moisture: pick(zone, [68, 72, 42, 72, 61, 55, 38, 66]),
    ec: pick(zone, [1.8, 1.6, 2.1, 1.7, 1.9, 1.5]),
    ph: pick(zone, [6.4, 6.6, 6.2, 6.8, 6.5]),
  };
}

export function moistureLevel(m: number): Level {
  return m < 45 ? "Low" : m > 85 ? "High" : "Good";
}
export function ecLevel(ec: number): Level {
  return ec < 1 ? "Low" : ec > 2.5 ? "High" : "Good";
}
export function phLevel(ph: number): Level {
  return ph < 5.8 ? "Low" : ph > 7.2 ? "High" : "Good";
}

/** Area in m², for litres per m². */
export const sampleArea = (zone: number) =>
  pick(zone, [180, 120, 250, 200, 160, 140, 220, 90]);

/** 12 readings, oldest first, ending at `last`. */
export function sampleTrend(last: number, zone = 1): number[] {
  return Array.from(
    { length: 12 },
    (_, i) => last + Math.sin((i + zone) * 1.3) * last * 0.08 + (11 - i) * 0.3,
  ).map((v, i, a) => (i === a.length - 1 ? last : v));
}

export type SampleDevice = {
  id: string;
  kind: "Sensors" | "Weather" | "Nutrients";
  name: string;
  where: string;
  reading: string;
  trend?: number[];
  low?: boolean;
};

export const SAMPLE_DEVICES: SampleDevice[] = [
  {
    id: "soil-1",
    kind: "Sensors",
    name: "Soil sensor 1",
    where: "Zone 1 · 15 cm",
    reading: "68%",
    trend: sampleTrend(68, 1),
  },
  {
    id: "soil-2",
    kind: "Sensors",
    name: "Soil sensor 2",
    where: "Zone 3 · 15 cm",
    reading: "42%",
    trend: sampleTrend(42, 3),
    low: true,
  },
  {
    id: "weather",
    kind: "Weather",
    name: "Weather station",
    where: "Main field",
    reading: "27.1 °C · 0 mm rain",
  },
  {
    id: "doser",
    kind: "Nutrients",
    name: "Nutrient doser",
    where: "Tank A",
    reading: "Ready · 64% full",
  },
];

export type NutrientDose = {
  time: string;
  product: string;
  zone: string;
  amount: string;
};

export const SAMPLE_NUTRIENTS: NutrientDose[] = [
  { time: "06:10", product: "NPK 20-20-20", zone: "Zone 1", amount: "120 ml" },
  {
    time: "08:40",
    product: "Calcium nitrate",
    zone: "Zone 2",
    amount: "80 ml",
  },
  { time: "18:10", product: "NPK 20-20-20", zone: "Zone 3", amount: "150 ml" },
];

export type Rule = { title: string; detail: string; on: boolean };

export const SAMPLE_RULES: Rule[] = [
  {
    title: "Skip when rain is coming",
    detail: "More than 5 mm forecast in the next 12 h",
    on: true,
  },
  {
    title: "Water when the soil is dry",
    detail: "Soil moisture under 40% in any zone",
    on: true,
  },
  {
    title: "Don't water in the midday heat",
    detail: "Between 11:00 and 16:00 above 32 °C",
    on: false,
  },
];

/** Daily series for the Soil, Nutrients and Weather analytics views. */
export function sampleDaily(
  days: number,
  base: number,
  swing: number,
): number[] {
  return Array.from({ length: days }, (_, i) =>
    Math.max(0, Math.round((base + Math.sin(i * 0.9) * swing) * 10) / 10),
  );
}
