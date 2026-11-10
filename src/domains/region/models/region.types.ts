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

/** Part of the day shown by the popularity heatmap. */
export type HeatPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite';

/**
 * Inputs of the popularity heatmap. The app spreads points around the commercial core and
 * along the main avenue, scaled by how busy each period is (0 to 1).
 */
export interface PopularityInfo {
  /** Busiest spot, usually the commercial centre. */
  core: Coordinate;
  /** Main avenue, drawn as a strip of points from `from` to `to`. */
  strip: { from: Coordinate; to: Coordinate };
  periods: Record<HeatPeriod, { core: number; strip: number }>;
  /** Where the numbers come from, shown under the map. */
  source: string;
}

/**
 * One document in the Firestore `regions` collection, keyed by slug. Only identity and location
 * are required: RAs still waiting for data show the map and the forum, and skip the other cards.
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
  popularity: PopularityInfo | null;
}
