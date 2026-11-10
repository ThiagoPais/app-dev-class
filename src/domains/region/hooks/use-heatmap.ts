import { useEffect, useState } from 'react';

import type { HeatmapLayer, HeatPeriod } from '../models/region.types';
import { getHeatmapLayers } from '../services/region.service';
import { periodForHour } from '../utils/heatmap';

const LOAD_ERROR = 'Não foi possível carregar o mapa de calor.';

/**
 * Heatmap state of a region page. Layers are fetched the first time the heatmap is switched on,
 * so a visit that never opens it costs no extra reads.
 */
export function useHeatmap(slug: string) {
  const [isActive, setIsActive] = useState(false);
  const [layers, setLayers] = useState<HeatmapLayer[] | null>(null);
  const [layerId, setLayerId] = useState<string | null>(null);
  const [period, setPeriod] = useState<HeatPeriod>(() => periodForHour(new Date().getHours()));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const shouldLoad = isActive && layers === null && errorMessage === null;

  useEffect(() => {
    if (!shouldLoad) return;
    let isCurrent = true;

    getHeatmapLayers(slug)
      .then((loaded) => {
        if (!isCurrent) return;
        setLayers(loaded);
        setLayerId((current) => current ?? loaded[0]?.id ?? null);
      })
      .catch((error) => {
        console.warn('[region] Failed to load heatmap layers:', error);
        if (isCurrent) setErrorMessage(LOAD_ERROR);
      });

    return () => {
      isCurrent = false;
    };
  }, [slug, shouldLoad, attempt]);

  const layer = layers?.find((item) => item.id === layerId) ?? null;

  return {
    isActive,
    toggle: () => setIsActive((current) => !current),
    isLoading: shouldLoad,
    errorMessage,
    retry: () => {
      setErrorMessage(null);
      setAttempt((current) => current + 1);
    },
    layers: layers ?? [],
    layer,
    selectLayer: setLayerId,
    period,
    setPeriod,
    /** Points currently drawn on the map (none while the heatmap is off). */
    points: isActive && layer ? layer.periods[period] : [],
  };
}
