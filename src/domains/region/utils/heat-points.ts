import type { Coordinates } from '../constants';

export interface HeatPoint extends Coordinates {
  /** Popularity from 0 to 1. */
  intensity: number;
}

/** Pings of people as degree offsets from the RA centre: a dense commercial core plus a main-avenue strip. */
const CORE_COUNT = 260;
const STRIP_COUNT = 80;

export type HeatPeriod = 'madrugada' | 'manha' | 'tarde' | 'noite';

/**
 * How busy each part of the day is: share of the commercial core and of the avenue strip that
 * has people, and how far the crowd drifts from the centre.
 */
export const HEAT_PERIODS: {
  id: HeatPeriod;
  label: string;
  core: number;
  strip: number;
  driftLat: number;
  driftLng: number;
}[] = [
  {
    id: 'madrugada',
    label: 'Madrugada',
    core: 0.3,
    strip: 0.55,
    driftLat: 0.0015,
    driftLng: 0.004,
  },
  { id: 'manha', label: 'Manhã', core: 0.15, strip: 0.2, driftLat: 0.0005, driftLng: -0.001 },
  { id: 'tarde', label: 'Tarde', core: 0.25, strip: 0.3, driftLat: 0, driftLng: 0 },
  { id: 'noite', label: 'Noite', core: 1, strip: 1, driftLat: -0.0015, driftLng: 0.002 },
];

/** Deterministic pseudo-random in [0, 1) so the mock does not change between renders. */
function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Mocked popularity around an RA until the forum exposes per-area activity. */
export function getHeatPoints(
  { latitude, longitude }: Coordinates,
  period: HeatPeriod = 'noite',
): HeatPoint[] {
  const config = HEAT_PERIODS.find((item) => item.id === period) ?? HEAT_PERIODS[3];
  const points: HeatPoint[] = [];
  latitude += config.driftLat;
  longitude += config.driftLng;

  for (let i = 0; i < Math.round(CORE_COUNT * config.core); i++) {
    const angle = seeded(i + 1) * Math.PI * 2;
    const distance = Math.pow(seeded(i + 101), 1.6) * 0.0045;
    points.push({
      latitude: latitude - 0.0008 + Math.sin(angle) * distance,
      longitude: longitude - 0.0015 + Math.cos(angle) * distance * 1.3,
      intensity: 1 - (distance / 0.0045) * 0.55,
    });
  }

  for (let i = 0; i < Math.round(STRIP_COUNT * config.strip); i++) {
    const t = i / (STRIP_COUNT - 1);
    points.push({
      latitude: latitude - 0.004 + t * 0.0075 + (seeded(i + 201) - 0.5) * 0.0008,
      longitude: longitude - 0.007 + t * 0.012,
      intensity: 0.35 + seeded(i + 301) * 0.3,
    });
  }

  return points;
}
