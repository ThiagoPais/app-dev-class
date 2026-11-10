import { useEffect, useState } from 'react';

import type { RegionDetails } from '../models/region.types';
import { getRegionDetails } from '../services/region.service';

const LOAD_ERROR = 'Não foi possível carregar os dados desta região.';

/** Loads the region page document. Screens are keyed by slug, so slug never changes here. */
export function useRegionDetails(slug: string) {
  const [region, setRegion] = useState<RegionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    getRegionDetails(slug)
      .then((details) => {
        if (!isCurrent) return;
        setRegion(details);
        setErrorMessage(null);
      })
      .catch(() => {
        if (isCurrent) setErrorMessage(LOAD_ERROR);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [slug, attempt]);

  const retry = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setAttempt((current) => current + 1);
  };

  return { region, isLoading, errorMessage, retry };
}
