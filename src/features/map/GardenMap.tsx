import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Shape } from "../../lib/geo";
import type { Place } from "../../lib/storage";
import { TILES, type TileName } from "../../services/mapTiles";
import styles from "./MapScreen.module.css";

export type MapZone = {
  zone: number;
  name: string;
  /** One line under the name, e.g. "Watering" or "68%". */
  detail: string;
  tone: "flow" | "ok" | "warn" | "off";
  shape: Shape;
};

type Props = {
  tiles: TileName;
  zones: MapZone[];
  /** Where to look when no zone has an outline yet. */
  center?: Place;
  onZone: (zone: number) => void;
  /** While drawing: the corners so far, and taps on the map add one. */
  drawing?: { points: Shape; onTap: (p: [number, number]) => void };
  /** Tiles failed to load (no internet, or the provider is unreachable). */
  onTileError: () => void;
};

/** Iran, for a first look before the garden is known. */
const START: L.LatLngExpression = [32.5, 53.7];

/** Leaflet, driven from props. Zones and the draft outline are redrawn on each change. */
export function GardenMap({
  tiles,
  zones,
  center,
  onZone,
  drawing,
  onTileError,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>(undefined);
  const layer = useRef<L.LayerGroup>(undefined);
  const framed = useRef(false);
  // Latest callbacks, so the map's own listeners never go stale.
  const live = useRef({ onZone, drawing, onTileError });
  live.current = { onZone, drawing, onTileError };

  useEffect(() => {
    const m = L.map(el.current!, {
      center: START,
      zoom: 5,
      zoomControl: false,
      attributionControl: true,
    });
    m.attributionControl.setPrefix(false);
    m.on("click", (e) =>
      live.current.drawing?.onTap([e.latlng.lat, e.latlng.lng]),
    );
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    return () => {
      m.remove();
      map.current = undefined;
      framed.current = false;
    };
  }, []);

  useEffect(() => {
    const t = TILES[tiles];
    const base = L.tileLayer(t.url, {
      attribution: t.attribution,
      maxNativeZoom: t.maxNativeZoom,
      maxZoom: 21,
    })
      .on("tileerror", () => live.current.onTileError())
      .addTo(map.current!);
    return () => void base.remove();
  }, [tiles]);

  useEffect(() => {
    const g = layer.current!;
    g.clearLayers();
    for (const z of zones) {
      const label = document.createElement("span");
      const b = document.createElement("b");
      b.textContent = z.name; // text, never HTML: names come from the board
      const d = document.createElement("span");
      d.textContent = z.detail;
      label.append(b, d);
      L.polygon(z.shape, { className: `${styles.plot} ${styles[z.tone]}` })
        .on("click", () => !live.current.drawing && live.current.onZone(z.zone))
        .bindTooltip(label, {
          permanent: true,
          direction: "center",
          className: `${styles.chip} ${z.tone === "flow" ? styles.chipFlow : ""}`,
        })
        .addTo(g);
    }
    if (drawing && drawing.points.length) {
      L.polyline(
        drawing.points.length > 2
          ? [...drawing.points, drawing.points[0]]
          : drawing.points,
        { className: styles.draft },
      ).addTo(g);
      for (const p of drawing.points)
        L.circleMarker(p, { radius: 6, className: styles.corner }).addTo(g);
    }
  }, [zones, drawing]);

  // Frame every outline once; until there are outlines, follow the garden's place.
  useEffect(() => {
    const all = zones.flatMap((z) => z.shape);
    if (framed.current || !all.length) return;
    map.current!.fitBounds(L.latLngBounds(all), {
      padding: [24, 24],
      maxZoom: 19,
    });
    framed.current = true;
  }, [zones]);

  useEffect(() => {
    if (center && !framed.current)
      map.current!.setView([center.lat, center.lon], 18);
  }, [center]);

  // classList, not className: a React className would wipe the classes Leaflet adds to this div.
  const isDrawing = !!drawing;
  useEffect(() => {
    el.current!.classList.toggle(styles.drawing, isDrawing);
  }, [isDrawing]);

  return <div ref={el} className={styles.leaflet} />;
}
