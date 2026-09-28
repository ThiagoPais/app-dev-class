import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { FORUM_REGION } from '../constants/regions';
import type { ForumTopic } from '../models/forumTypes';
import { listCityTopics, listRegionTopics, normalizeCityName } from '../services/forum.service';

const LOAD_ERROR = 'Não foi possível carregar os tópicos. Puxe para atualizar.';

/**
 * Every topic belongs to the DF region, so the "all RAs" feed reuses the region
 * index (ordered by last reply) and moves pinned topics to the top here.
 */
function pinnedFirst(topics: ForumTopic[]): ForumTopic[] {
  return [...topics].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
}

/**
 * Loads the forum feed (all RAs, or a single one when `city` is set) and keeps it
 * fresh every time the screen regains focus, e.g. after creating a topic.
 */
export function useTopicFeed(city: string | null) {
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'focus' | 'refresh') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setIsRefreshing(true);

      try {
        const result = city
          ? await listCityTopics(normalizeCityName(city))
          : pinnedFirst(await listRegionTopics(FORUM_REGION, 30));
        if (id !== requestId.current) return;
        setTopics(result);
        setErrorMessage(null);
      } catch (error) {
        // Firestore puts the link to create a missing index in this message
        console.warn('[forum] Failed to load forum feed:', error);
        if (id !== requestId.current) return;
        setErrorMessage(LOAD_ERROR);
      } finally {
        if (id === requestId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [city]
  );

  useFocusEffect(
    useCallback(() => {
      void load('focus');
    }, [load])
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  const filteredTopics = useMemo(() => {
    const term = normalizeCityName(search);
    if (!term) return topics;

    return topics.filter((topic) =>
      [topic.title, topic.content, topic.city].some((field) =>
        normalizeCityName(field).includes(term)
      )
    );
  }, [search, topics]);

  return {
    topics: filteredTopics,
    hasTopics: topics.length > 0,
    search,
    setSearch,
    isLoading,
    isRefreshing,
    errorMessage,
    refresh,
  };
}
