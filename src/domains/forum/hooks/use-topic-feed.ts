import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { ForumCategory } from '../constants/categories';
import { FORUM_REGION } from '../constants/regions';
import type { ForumTopic } from '../models/forumTypes';
import { getTopicFeedPage, type ForumCursor } from '../services/forum.service';

const LOAD_ERROR = 'Não foi possível carregar os tópicos. Tente novamente.';

function pinnedFirst(topics: ForumTopic[]): ForumTopic[] {
  return [...topics].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
}

export function useTopicFeed(city: string | null, category: ForumCategory | null = null) {
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestId = useRef(0);
  const pending = useRef(false);
  const failedMode = useRef<'focus' | 'refresh' | 'more'>('focus');
  const nextPage = useRef({ cursor: null as ForumCursor, hasMore: false, scope: '' });
  const scope = JSON.stringify([city, category, search]);

  const load = useCallback(
    async (mode: 'focus' | 'refresh' | 'more') => {
      if (mode === 'more' && (
        pending.current || !nextPage.current.hasMore || nextPage.current.scope !== scope
      )) return;
      const id = ++requestId.current;
      const isActive = () => id === requestId.current;
      pending.current = true;
      setErrorMessage(null);
      setIsLoadingMore(mode === 'more');
      setIsRefreshing(mode === 'refresh');
      if (mode === 'focus') {
        setIsLoading(true);
        setTopics([]);
        setHasMore(false);
      }

      try {
        const page = await getTopicFeedPage(
          { region: FORUM_REGION, city, category, search },
          mode === 'more' ? nextPage.current.cursor : null, isActive
        );
        if (!isActive()) return;
        nextPage.current = { cursor: page.cursor, hasMore: page.hasMore, scope };
        setTopics((current) => {
          const combined = mode === 'more' ? [...current, ...page.items] : page.items;
          return pinnedFirst([...new Map(combined.map((topic) => [topic.id, topic])).values()]);
        });
        setHasMore(page.hasMore);
      } catch (error) {
        console.warn('[forum] Failed to load forum feed:', error);
        if (isActive()) {
          failedMode.current = mode;
          setErrorMessage(LOAD_ERROR);
        }
      } finally {
        if (isActive()) {
          pending.current = false;
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [city, category, search, scope]
  );

  useFocusEffect(
    useCallback(() => {
      // Changing the filter invalidates older requests before the debounce ends.
      const timer = setTimeout(() => void load('focus'), search.trim() ? 300 : 0);
      return () => {
        clearTimeout(timer);
        requestId.current += 1;
        pending.current = false;
      };
    }, [load, search])
  );

  const changeSearch = useCallback((value: string) => {
    if (value === search) return;
    requestId.current += 1;
    pending.current = false;
    setSearch(value);
    setIsLoading(true);
    setTopics([]);
    setHasMore(false);
  }, [search]);

  const refresh = useCallback(() => load('refresh'), [load]);
  const loadMore = useCallback(() => load('more'), [load]);
  const retry = useCallback(() => load(failedMode.current), [load]);

  return {
    topics,
    hasTopics: topics.length > 0,
    search,
    setSearch: changeSearch,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    errorMessage,
    refresh,
    loadMore,
    retry,
  };
}
