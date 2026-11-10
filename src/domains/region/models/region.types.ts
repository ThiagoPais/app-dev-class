/** One administrative region (RA) as listed on the search screen. */
export interface RegionSummary {
  slug: string;
  name: string;
  /** RA name used by the forum, e.g. Asa Norte belongs to "Plano Piloto". */
  forumCity: string;
}

export interface RegionPhoto {
  uri: string;
  caption?: string;
  credit?: string;
}

export type TransportMode = 'metro' | 'bus' | 'bike';

export interface MobilityInfo {
  title: string;
  summary: string;
  modes: { mode: TransportMode; label: string; available: boolean }[];
  source: string;
}

/** Infrastructure residents reported near their homes (checklist card). */
export interface SurroundingsInfo {
  title: string;
  items: string[];
  source: string;
}

export interface LeisureInfo {
  title: string;
  items: { label: string; percentage: number }[];
  source: string;
}

/** Average household income of every RA, so this region can be placed in the ranking. */
export interface IncomeInfo {
  title: string;
  description: string;
  ranking: { region: string; value: number }[];
  source: string;
}

export interface SafetyInfo {
  title: string;
  /**
   * Y axis ticks. They are spaced evenly even when the values are not, so a handful of
   * crimes and a couple hundred fit in the same chart.
   */
  axisTicks: number[];
  occurrences: { label: string; count: number }[];
  summary: string;
  source: string;
  warning?: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RegionLocation extends Coordinate {
  latitudeDelta: number;
  longitudeDelta: number;
  /** Approximate outline of the region, drawn over the map. */
  boundary: Coordinate[];
}

/** Part of the day shown by the heatmap. */
export type HeatPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite';

/** One weighted spot of a heatmap layer. `weight` goes from 0 (quiet) to 1 (hottest). */
export interface HeatPoint extends Coordinate {
  weight: number;
}

/**
 * One heatmap layer of an RA, stored in `regions/{slug}/heatmap_layers/{id}`. Each document
 * holds the points of every period, so editing a layer in the Firebase console changes the map.
 */
export interface HeatmapLayer {
  id: string;
  label: string;
  /** One line under the map explaining what the colours mean. */
  description: string;
  /** Ionicons glyph shown on the layer chip. */
  icon: string;
  /** Position among the layer chips (lowest first). */
  order: number;
  /** Gradient from low to high, used by the map and the legend. */
  colors: string[];
  source: string;
  /** True while the points are placeholders waiting for real data. */
  isSample: boolean;
  periods: Record<HeatPeriod, HeatPoint[]>;
}

/**
 * One document in the Firestore `regions` collection, keyed by slug. Only identity and location
 * are required: cards whose section is missing are hidden.
 */
export interface RegionDetails extends RegionSummary {
  photos: RegionPhoto[];
  tags: string[];
  description: string | null;
  mobility: MobilityInfo | null;
  surroundings: SurroundingsInfo | null;
  leisure: LeisureInfo | null;
  income: IncomeInfo | null;
  safety: SafetyInfo | null;
  location: RegionLocation;
  /** True while the page shows placeholder numbers; the screen labels them as examples. */
  isSample: boolean;
}
