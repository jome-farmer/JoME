/**
 * Map tiles for the Map tab. Street view is OpenStreetMap; satellite is Esri
 * World Imagery (OSM has no imagery). Both need internet; the app works
 * without them, the map just stays blank.
 *
 * ponytail: tiles straight from the providers. If Esri is blocked from Iran or
 * its terms need an ArcGIS key in production, proxy them through DouSHamBE.
 */
export type TileLayer = {
  url: string;
  attribution: string;
  /** Deepest zoom the provider has; Leaflet scales past it. */
  maxNativeZoom: number;
};

export const TILES = {
  Satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community",
    maxNativeZoom: 19,
  },
  Street: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
} satisfies Record<string, TileLayer>;

export type TileName = keyof typeof TILES;
