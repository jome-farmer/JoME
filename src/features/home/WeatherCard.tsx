import { useEffect, useState } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LocateFixed,
  Moon,
  Sun,
  Umbrella,
  type LucideIcon,
} from "lucide-react";
import { getGardenPlace, setGardenPlace, type Place } from "../../lib/storage";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import {
  describe,
  getWeather,
  phonePlace,
  roundPlace,
  type Sky,
  type Weather,
} from "./weather";
import styles from "./WeatherCard.module.css";

const ICON: Record<Sky, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const deg = (c: number) => `${Math.round(c)}°`;

type State =
  | { kind: "loading" }
  | { kind: "ask" }
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "failed" }
  | { kind: "ready"; weather: Weather };

/**
 * Weather at the garden (design/README.md screen 5). The place is this phone's
 * position, saved per controller, asked for only when the user taps.
 */
export function WeatherCard({ serial }: { serial: string }) {
  const [place, setPlace] = useState<Place>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void getGardenPlace(serial).then((p) => {
      if (!live) return;
      setPlace(p);
      if (!p) setState({ kind: "ask" });
    });
    return () => {
      live = false;
    };
  }, [serial]);

  useEffect(() => {
    if (!place) return;
    let live = true;
    getWeather(place).then(
      (weather) => live && setState({ kind: "ready", weather }),
      () => live && setState({ kind: "failed" }),
    );
    return () => {
      live = false;
    };
  }, [place]);

  const locate = async () => {
    setState({ kind: "locating" });
    try {
      const p = roundPlace(await phonePlace());
      await setGardenPlace(serial, p);
      setPlace(p);
    } catch (e) {
      const denied = (e as GeolocationPositionError)?.code === 1;
      setState({ kind: denied ? "denied" : "failed" });
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.label}>Weather</h2>
      <Card className={styles.card}>
        {state.kind === "ready" ? (
          <Forecast weather={state.weather} onUpdate={locate} />
        ) : state.kind === "loading" ? (
          <p className={styles.note}>Checking the weather…</p>
        ) : state.kind === "failed" && place ? (
          <p className={styles.note}>
            Couldn&apos;t get the weather. It needs internet; your garden keeps
            running on schedule.
          </p>
        ) : (
          <div className={styles.ask}>
            <p className={styles.note}>
              {state.kind === "denied"
                ? "Location is off for JoME. Allow it in your phone's settings to see the weather at your garden."
                : state.kind === "failed"
                  ? "Couldn't find this phone's location. Try again outside or with internet on."
                  : "See the weather at your garden. Use this phone's location while you're there; it's saved on this phone and sent to Open-Meteo, rounded to about 1 km."}
            </p>
            <Button
              variant="secondary"
              icon={LocateFixed}
              loading={state.kind === "locating"}
              onClick={() => void locate()}
            >
              Use this phone&apos;s location
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

function Forecast({
  weather,
  onUpdate,
}: {
  weather: Weather;
  onUpdate: () => void;
}) {
  const { now, days } = weather;
  const [today, ...next] = days;
  const sky = describe(now.code);
  const NowIcon = sky.sky === "clear" && !now.isDay ? Moon : ICON[sky.sky];
  return (
    <>
      <div className={styles.now}>
        <NowIcon size={40} strokeWidth={1.5} aria-hidden />
        <div>
          <b className={styles.temp}>{deg(now.tempC)}</b>
          <span className={styles.sky}>{sky.label}</span>
        </div>
        {today && (
          <p className={styles.meta}>
            H {deg(today.maxC)} · L {deg(today.minC)}
            {today.rainPct !== null && ` · Rain ${today.rainPct}%`}
          </p>
        )}
      </div>
      <ul className={styles.days}>
        {next.slice(0, 5).map((d) => {
          const day = describe(d.code);
          const Icon = ICON[day.sky];
          const name = WEEKDAY[new Date(`${d.date}T12:00`).getDay()];
          return (
            <li
              key={d.date}
              aria-label={`${name}: ${day.label}, ${deg(d.maxC)} to ${deg(d.minC)}${d.rainPct !== null ? `, ${d.rainPct}% chance of rain` : ""}`}
            >
              <span className={styles.day}>{name}</span>
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              <span className={styles.range}>
                {deg(d.maxC)} <span>{deg(d.minC)}</span>
              </span>
              <span className={styles.rain}>
                <Umbrella size={12} strokeWidth={2} aria-hidden />
                {d.rainPct !== null ? `${d.rainPct}%` : "–"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.source}>
        Open-Meteo ·{" "}
        <button type="button" className={styles.link} onClick={onUpdate}>
          Update location
        </button>
      </p>
    </>
  );
}
