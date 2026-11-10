import type { Coordinate, HeatPeriod, PopularityInfo } from '../models/region.types';

export interface HeatPoint extends Coordinate {
  /** Popularity from 0 to 1. */
  intensity: number;
}

/** Points at full activity: a dense commercial core plus a main-avenue strip. */
const CORE_COUNT = 260;
const STRIP_COUNT = 80;
/** Radius of the core cluster, in degrees (about 500 m). */
const CORE_SPREAD = 0.0045;

/** Periods in display order. `drift` moves the crowd a little so each period looks distinct. */
export const HEAT_PERIODS: { id: HeatPeriod; label: string; driftLat: number; driftLng: number }[] =
  [
    { id: 'madrugada', label: 'Madrugada', driftLat: 0.0015, driftLng: 0.004 },
    { id: 'manha', label: 'Manhã', driftLat: 0.0005, driftLng: -0.001 },
    { id: 'tarde', label: 'Tarde', driftLat: 0, driftLng: 0 },
    { id: 'noite', label: 'Noite', driftLat: -0.0015, driftLng: 0.002 },
  ];

/** Activity levels used when an RA has no measured profile yet. */
export const DEFAULT_PERIOD_LEVELS: PopularityInfo['periods'] = {
  madrugada: { core: 0.3, strip: 0.55 },
  manha: { core: 0.15, strip: 0.2 },
  tarde: { core: 0.25, strip: 0.3 },
  noite: { core: 1, strip: 1 },
};

/** Heatmap inputs for an RA centre: core just south-west of it, avenue crossing it diagonally. */
export function defaultPopularity({ latitude, longitude }: Coordinate, source: string): PopularityInfo {
  return {
    core: { latitude: latitude - 0.0008, longitude: longitude - 0.0015 },
    strip: {
      from: { latitude: latitude - 0.004, longitude: longitude - 0.007 },
      to: { latitude: latitude + 0.0035, longitude: longitude + 0.005 },
    },
    periods: DEFAULT_PERIOD_LEVELS,
    source,
  };
}

/** Deterministic pseudo-random in [0, 1) so the points do not move between renders. */
function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Expands an RA's popularity profile into weighted points for one period of the day. */
export function getHeatPoints(popularity: PopularityInfo, period: HeatPeriod = 'noite'): HeatPoint[] {
  const config = HEAT_PERIODS.find((item) => item.id === period) ?? HEAT_PERIODS[3];
  const levels = popularity.periods[config.id];
  const { core, strip } = popularity;
  const points: HeatPoint[] = [];

  const coreCount = Math.round(CORE_COUNT * clamp01(levels.core));
  for (let i = 0; i < coreCount; i++) {
    const angle = seeded(i + 1) * Math.PI * 2;
    const distance = Math.pow(seeded(i + 101), 1.6) * CORE_SPREAD;
    points.push({
      latitude: core.latitude + config.driftLat + Math.sin(angle) * distance,
      longitude: core.longitude + config.driftLng + Math.cos(angle) * distance * 1.3,
      intensity: 1 - (distance / CORE_SPREAD) * 0.55,
    });
  }

  const stripCount = Math.round(STRIP_COUNT * clamp01(levels.strip));
  for (let i = 0; i < stripCount; i++) {
    const t = i / (STRIP_COUNT - 1);
    points.push({
      latitude:
        strip.from.latitude +
        config.driftLat +
        t * (strip.to.latitude - strip.from.latitude) +
        (seeded(i + 201) - 0.5) * 0.0008,
      longitude:
        strip.from.longitude + config.driftLng + t * (strip.to.longitude - strip.from.longitude),
      intensity: 0.35 + seeded(i + 301) * 0.3,
    });
  }

  return points;
}
