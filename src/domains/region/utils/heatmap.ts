import type { HeatPeriod } from '../models/region.types';

/** Periods in display order, with the hours each one covers. */
export const HEAT_PERIODS: { id: HeatPeriod; label: string; startHour: number }[] = [
  { id: 'madrugada', label: 'Madrugada', startHour: 0 },
  { id: 'manha', label: 'Manhã', startHour: 6 },
  { id: 'tarde', label: 'Tarde', startHour: 12 },
  { id: 'noite', label: 'Noite', startHour: 18 },
];

/** Low → high gradient used when a layer document does not set its own colours. */
export const DEFAULT_HEAT_COLORS = ['#F7C6D6', '#E96E97', '#B83A6B', '#832D51'];

/** Period that matches the given time, so the map opens on "now". */
export function periodForHour(hour: number): HeatPeriod {
  let current = HEAT_PERIODS[0].id;
  for (const period of HEAT_PERIODS) {
    if (hour >= period.startHour) current = period.id;
  }
  return current;
}
