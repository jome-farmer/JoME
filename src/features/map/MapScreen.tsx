import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CloudSun,
  Droplet,
  Droplets,
  Layers,
  LocateFixed,
  PenLine,
  Plug,
  Sprout,
  Square,
  Thermometer,
} from "lucide-react";
import { useDeviceClient, useOfflineReason } from "../../device/hooks";
import { useGarden } from "../../device/useGarden";
import { useAppDispatch, useAppSelector } from "../../store";
import { selectDevice } from "../../store/deviceSlice";
import { stopZone } from "../../store/gardenSlice";
import { errorText } from "../../services/device/errors";
import {
  moistureLevel,
  SAMPLE_DEVICES,
  sampleSoil,
} from "../../services/field";
import type { TileName } from "../../services/mapTiles";
import { phonePlace, type Shape } from "../../lib/geo";
import {
  getGardenPlace,
  getZoneShapes,
  setZoneShapes,
  type Place,
  type ZoneShapes,
} from "../../lib/storage";
import { formatDuration, formatTemperature, whenLabel } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Sparkline } from "../../ui/Chart";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { List, ListRow } from "../../ui/ListRow";
import { Screen } from "../../ui/Screen";
import { Segmented } from "../../ui/Segmented";
import { StatusPill } from "../../ui/StatusPill";
import { GardenMap, type MapZone } from "./GardenMap";
import styles from "./MapScreen.module.css";

const VIEWS = ["Map", "Zones", "Sensors"] as const;
type View = (typeof VIEWS)[number];

/** The garden on a real map (satellite or OpenStreetMap): each zone's outline, coloured by what it's doing. */
export function MapScreen() {
  const { state } = useAppSelector(selectDevice);
  const client = useDeviceClient();
  const navigate = useNavigate();

  if (state !== "ready" || !client) {
    return (
      <Screen title="Map">
        <EmptyState
          title="Your garden map will appear here"
          action={
            <Button icon={Plug} onClick={() => navigate("/connect")}>
              Connect a controller
            </Button>
          }
        >
          See every zone from above, and which one is watering.
        </EmptyState>
      </Screen>
    );
  }
  return <Connected />;
}

function Connected() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { info } = useAppSelector(selectDevice);
  const garden = useGarden();
  const { zones, run, sensors } = garden;
  const [view, setView] = useState<View>("Map");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const offlineReason = useOfflineReason();
  const running = run ? zones.find((z) => z.zone === run.zone) : undefined;
  const open = (zone: number) => navigate(`/zones/${zone}`);
  const serial = info?.serial ?? "";
  const [tiles, setTiles] = useState<TileName>("Satellite");
  const [shapes, setShapes] = useState<ZoneShapes>({});
  const [place, setPlace] = useState<Place>();
  const [tileError, setTileError] = useState(false);
  const [locating, setLocating] = useState(false);
  // Zone detail's "Draw outline" lands here with the zone to draw.
  const askedToDraw = (useLocation().state as { draw?: number } | null)?.draw;
  const [drawing, setDrawing] = useState<{ zone: number; points: Shape }>();

  useEffect(() => {
    let live = true;
    void Promise.all([getZoneShapes(serial), getGardenPlace(serial)]).then(
      ([s, p]) => {
        if (!live) return;
        setShapes(s);
        setPlace(p);
        if (askedToDraw !== undefined)
          setDrawing({ zone: askedToDraw, points: s[askedToDraw] ?? [] });
      },
    );
    return () => {
      live = false;
    };
  }, [serial, askedToDraw]);

  const locate = async () => {
    setLocating(true);
    try {
      setPlace(await phonePlace());
    } catch {
      setError(
        "Couldn't find this phone's location. Allow location for JoME in settings, or move the map by hand.",
      );
    } finally {
      setLocating(false);
    }
  };

  const saveShapes = (next: ZoneShapes) => {
    setShapes(next);
    void setZoneShapes(serial, next);
  };

  const mapZones: MapZone[] = zones
    .filter((z) => shapes[z.zone]?.length >= 3 && z.zone !== drawing?.zone)
    .map((z) => {
      const moisture = sampleSoil(z.zone).moisture;
      const low = moistureLevel(moisture) === "Low";
      return {
        zone: z.zone,
        name: z.name,
        shape: shapes[z.zone],
        tone:
          run?.zone === z.zone
            ? "flow"
            : !z.enabled
              ? "off"
              : low
                ? "warn"
                : "ok",
        detail:
          run?.zone === z.zone
            ? `Watering · ${formatDuration(garden.remaining)} left`
            : !z.enabled
              ? "Off"
              : `Soil ${moisture}%${low ? " · Low" : ""}`,
      };
    });
  const unmapped = zones.filter((z) => !(shapes[z.zone]?.length >= 3));
  const drawingZone = zones.find((z) => z.zone === drawing?.zone);

  const stop = async () => {
    if (offlineReason) return setError(offlineReason);
    if (!run) return;
    setBusy(true);
    setError(undefined);
    try {
      await dispatch(stopZone(run.zone));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={info?.name ?? "Garden"}
      subtitle={`${zones.length} ${zones.length === 1 ? "zone" : "zones"}`}
      actions={
        sensors?.temperatureC !== undefined && (
          <StatusPill tone="idle" icon={Thermometer}>
            {formatTemperature(sensors.temperatureC)}
          </StatusPill>
        )
      }
    >
      <Segmented options={VIEWS} value={view} onChange={setView} label="View" />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {view === "Map" && (
        <>
          <div className={styles.map}>
            <GardenMap
              tiles={tiles}
              zones={mapZones}
              center={place}
              onZone={open}
              onTileError={() => setTileError(true)}
              drawing={
                drawing && {
                  points: drawing.points,
                  onTap: (p) =>
                    setDrawing((d) => d && { ...d, points: [...d.points, p] }),
                }
              }
            />
            <div className={styles.tools}>
              <IconButton
                icon={LocateFixed}
                label="Go to this phone's location"
                disabled={locating}
                onClick={() => void locate()}
              />
              <IconButton
                icon={Layers}
                label={tiles === "Satellite" ? "Street map" : "Satellite view"}
                onClick={() =>
                  setTiles((t) => (t === "Satellite" ? "Street" : "Satellite"))
                }
              />
            </div>
            {tileError ? (
              <span className={styles.sample}>
                The map needs internet. Your garden keeps running on schedule.
              </span>
            ) : !place && mapZones.length === 0 && !drawing ? (
              <span className={styles.sample}>
                Standing in the garden? Tap the target to find it.
              </span>
            ) : (
              mapZones.length > 0 && (
                <span className={styles.sample}>
                  Soil moisture is sample data
                </span>
              )
            )}
          </div>

          {drawing ? (
            <Card className={styles.drawBar}>
              <label className={styles.drawZone}>
                <span>Outline of</span>
                <select
                  value={drawing.zone}
                  onChange={(e) => {
                    const zone = Number(e.target.value);
                    setDrawing({ zone, points: shapes[zone] ?? [] });
                  }}
                >
                  {zones.map((z) => (
                    <option key={z.zone} value={z.zone}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className={styles.meta}>
                {drawing.points.length < 3
                  ? `Tap each corner of ${drawingZone?.name ?? "the zone"} on the map, in order. ${drawing.points.length} of at least 3.`
                  : `${drawing.points.length} corners. Tap to add more, or save.`}
              </span>
              <div className={styles.drawActions}>
                <Button
                  variant="secondary"
                  disabled={!drawing.points.length}
                  onClick={() =>
                    setDrawing({
                      ...drawing,
                      points: drawing.points.slice(0, -1),
                    })
                  }
                >
                  Undo
                </Button>
                <Button variant="ghost" onClick={() => setDrawing(undefined)}>
                  Cancel
                </Button>
                <Button
                  haptic
                  disabled={drawing.points.length < 3}
                  onClick={() => {
                    saveShapes({ ...shapes, [drawing.zone]: drawing.points });
                    setDrawing(undefined);
                  }}
                >
                  Save
                </Button>
              </div>
              {shapes[drawing.zone] && (
                <Button
                  variant="danger"
                  onClick={() => {
                    const next = { ...shapes };
                    delete next[drawing.zone];
                    saveShapes(next);
                    setDrawing(undefined);
                  }}
                >
                  Remove this outline
                </Button>
              )}
            </Card>
          ) : (
            zones.length > 0 && (
              <Button
                variant="secondary"
                icon={PenLine}
                onClick={() =>
                  setDrawing({
                    zone: (unmapped[0] ?? zones[0]).zone,
                    points: shapes[(unmapped[0] ?? zones[0]).zone] ?? [],
                  })
                }
              >
                {unmapped.length
                  ? `Draw zone outlines · ${unmapped.length} to go`
                  : "Edit zone outlines"}
              </Button>
            )
          )}
        </>
      )}

      {view === "Zones" && (
        <List>
          {zones.map((z) => {
            const moisture = sampleSoil(z.zone).moisture;
            return (
              <ListRow
                key={z.zone}
                icon={Sprout}
                title={z.name}
                subtitle={
                  run?.zone === z.zone
                    ? `Watering · ${formatDuration(garden.remaining)} left`
                    : z.enabled
                      ? `Idle · soil ${moisture}% (sample)`
                      : "Off"
                }
                onClick={() => open(z.zone)}
              />
            );
          })}
        </List>
      )}

      {view === "Sensors" && (
        <>
          <StatusPill tone="off">Sample data · no sensors yet</StatusPill>
          <List>
            {SAMPLE_DEVICES.filter(
              (d) => d.kind === "Sensors" || d.kind === "Weather",
            ).map((d) => (
              <ListRow
                key={d.id}
                icon={d.kind === "Weather" ? CloudSun : Droplets}
                title={d.name}
                subtitle={`${d.where} · ${d.reading}`}
                trailing={
                  d.trend && (
                    <span className={styles.spark}>
                      <Sparkline
                        values={d.trend}
                        tone={d.low ? "warn" : "ok"}
                      />
                    </span>
                  )
                }
              />
            ))}
          </List>
        </>
      )}

      <Card className={styles.now}>
        {running && run ? (
          <>
            <Droplet
              size={28}
              fill="currentColor"
              className={styles.flowIcon}
              aria-hidden
            />
            <span className={styles.nowText}>
              <b>{running.name}</b>
              <span className={styles.flowText}>Watering</span>
              <span className={styles.meta}>
                {formatDuration(garden.remaining)} left
              </span>
            </span>
            <Button
              variant="secondary"
              icon={Square}
              haptic
              loading={busy}
              aria-disabled={!!offlineReason}
              onClick={() => void stop()}
            >
              Stop
            </Button>
          </>
        ) : (
          <span className={styles.nowText}>
            <b>Nothing watering</b>
            <span className={styles.meta}>
              {garden.status?.nextRun
                ? `Next: ${garden.status.nextRun.name}, ${whenLabel(garden.status.nextRun.at, new Date(garden.now))}`
                : "No program scheduled"}
            </span>
          </span>
        )}
      </Card>
    </Screen>
  );
}
