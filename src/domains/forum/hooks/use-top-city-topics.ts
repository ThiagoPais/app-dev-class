import { useEffect, useState } from 'react';

import type { ForumTopic } from '../models/forumTypes';
import { listCityTopics, normalizeCityName } from '../services/forum.service';

const LOAD_ERROR = 'Não foi possível carregar os destaques.';
const TOP_TOPICS_COUNT = 3;

interface TopTopicsResult {
  city: string;
  topics: ForumTopic[];
  failed: boolean;
}

/** The three most voted topics of one RA, best first. */
export function useTopCityTopics(city: string) {
  const [result, setResult] = useState<TopTopicsResult | null>(null);

  useEffect(() => {
    let isActive = true;

    listCityTopics(normalizeCityName(city), 'top', TOP_TOPICS_COUNT)
      .then((page) => {
        if (isActive) setResult({ city, topics: page.items, failed: false });
      })
      .catch((error) => {
        console.warn('[forum] Failed to load top topics:', error);
        if (isActive) setResult({ city, topics: [], failed: true });
      });

    return () => {
      isActive = false;
    };
  }, [city]);

  // A result for another RA means the current one is still loading.
  const current = result?.city === city ? result : null;

  return {
    topics: current?.topics ?? [],
    isLoading: !current,
    errorMessage: current?.failed ? LOAD_ERROR : null,
  };
}
