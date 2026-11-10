import { useMemo, useState } from 'react';

import type { HeatPeriod, PopularityInfo } from '../models/region.types';
import { getHeatPoints } from '../utils/heat-points';

/** Heatmap toggle and period state shared by the native and web maps. */
export function useHeatmap(popularity: PopularityInfo | null) {
  const [showHeat, setShowHeat] = useState(false);
  const [period, setPeriod] = useState<HeatPeriod>('noite');
  const heatPoints = useMemo(
    () => (popularity && showHeat ? getHeatPoints(popularity, period) : []),
    [popularity, period, showHeat]
  );

  return {
    showHeat,
    toggleHeat: () => setShowHeat((current) => !current),
    period,
    setPeriod,
    heatPoints,
  };
}
