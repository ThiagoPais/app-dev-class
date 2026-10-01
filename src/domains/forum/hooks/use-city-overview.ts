import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { FORUM_CITIES, FORUM_REGION } from '../constants/regions';
import type { ForumTopic } from '../models/forumTypes';
import { listRegionTopics, type ForumCursor } from '../services/forum.service';

/** Most recent topics read to build the RA cards; older activity is not counted. */
const MAX_TOPICS = 200;
const PAGE_SIZE = 50;
const LOAD_ERROR = 'Não foi possível carregar as conversas. Puxe para atualizar.';

export interface CityOverview {
  city: string;
  topicsCount: number;
  repliesCount: number;
  likesCount: number;
  latestTopic: ForumTopic | null;
  lastActivityAt: Date | null;
}

function buildOverview(topics: ForumTopic[]): CityOverview[] {
  const byCity = new Map<string, CityOverview>(
    FORUM_CITIES.map((city) => [
      city,
      { city, topicsCount: 0, repliesCount: 0, likesCount: 0, latestTopic: null, lastActivityAt: null },
    ])
  );

  // Topics arrive ordered by last reply, so the first one seen per RA is the latest.
  for (const topic of topics) {
    const overview = byCity.get(topic.city);
    if (!overview) continue;
    overview.topicsCount += 1;
    overview.repliesCount += topic.repliesCount;
    overview.likesCount += topic.upvotesCount;
    if (!overview.latestTopic) {
      overview.latestTopic = topic;
      overview.lastActivityAt = topic.lastReplyAt;
    }
  }

  // Active RAs first (most recent activity on top), then the rest alphabetically.
  return [...byCity.values()].sort((a, b) => {
    if (a.lastActivityAt && b.lastActivityAt) {
      return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
    }
    if (a.lastActivityAt) return -1;
    if (b.lastActivityAt) return 1;
    return a.city.localeCompare(b.city, 'pt-BR');
  });
}

/**
 * Summary of every RA forum (conversation count, latest topic, activity) built
 * from the most recent DF topics, so no extra index or aggregate document is needed.
 */
export function useCityOverview() {
  const [cities, setCities] = useState<CityOverview[]>(() => buildOverview([]));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (mode: 'focus' | 'refresh') => {
    const id = ++requestId.current;
    if (mode === 'refresh') setIsRefreshing(true);

    try {
      const topics: ForumTopic[] = [];
      let cursor: ForumCursor = null;
      let hasMore = true;

      while (hasMore && topics.length < MAX_TOPICS && id === requestId.current) {
        const page = await listRegionTopics(FORUM_REGION, PAGE_SIZE, cursor);
        topics.push(...page.items);
        cursor = page.cursor;
        hasMore = page.hasMore;
      }

      if (id !== requestId.current) return;
      setCities(buildOverview(topics));
      setErrorMessage(null);
    } catch (error) {
      console.warn('[forum] Failed to load RA overview:', error);
      if (id === requestId.current) setErrorMessage(LOAD_ERROR);
    } finally {
      if (id === requestId.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load('focus');
      return () => {
        requestId.current += 1;
      };
    }, [load])
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  return { cities, isLoading, isRefreshing, errorMessage, refresh };
}
