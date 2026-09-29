import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/domains/auth';

import type { ForumMessage, ForumTopic, VoteType } from '../models/forumTypes';
import {
  castMessageVote,
  castTopicVote,
  createForumMessage,
  getForumTopic,
  getUserMessageVote,
  getUserTopicVote,
  listTopicMessages,
  softDeleteForumMessage,
  softDeleteForumTopic,
  updateForumMessage,
  type ForumCursor,
} from '../services/forum.service';
import { applyVote } from '../utils/votes';

export const TOPIC_NOT_FOUND = 'Este tópico não existe ou foi removido.';
const LOAD_ERROR = 'Não foi possível carregar o tópico. Tente novamente.';

/**
 * State and actions for a single topic: its replies, the current user's votes,
 * and replying / editing / deleting. Votes are applied optimistically and
 * reverted if the write fails.
 */
export function useTopicDetail(topicId: string) {
  const { user } = useAuth();
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [topicVote, setTopicVote] = useState<VoteType | null>(null);
  const [messageVotes, setMessageVotes] = useState<Record<string, VoteType | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingVotes = useRef(new Set<string>());
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);
  const pendingLoad = useRef(false);
  const pendingMutations = useRef(new Set<Promise<unknown>>());
  const mutationVersion = useRef(0);
  const failedMode = useRef<'focus' | 'refresh' | 'more'>('focus');
  const nextPage = useRef({ cursor: null as ForumCursor, hasMore: false, topicId: '' });

  const userId = user?.id ?? null;

  const runMutation = useCallback(async <T>(action: () => Promise<T>): Promise<T> => {
    mutationVersion.current += 1;
    const pending = action();
    pendingMutations.current.add(pending);
    try {
      return await pending;
    } finally {
      pendingMutations.current.delete(pending);
      mutationVersion.current += 1;
    }
  }, []);

  const load = useCallback(
    async (mode: 'focus' | 'refresh' | 'more') => {
      if (!userId) return;
      if (mode === 'more' && (
        pendingLoad.current || !nextPage.current.hasMore || nextPage.current.topicId !== topicId
      )) return;
      const id = ++requestId.current;
      const isActive = () => id === requestId.current;
      pendingLoad.current = true;
      setErrorMessage(null);
      setIsLoadingMore(mode === 'more');
      setIsRefreshing(mode === 'refresh');
      if (mode === 'focus') setIsLoading(true);

      try {
        while (isActive()) {
          // Read after writes settle so snapshots cannot replace local changes.
          while (pendingMutations.current.size) {
            await Promise.allSettled([...pendingMutations.current]);
            if (!isActive()) return;
          }
          const version = mutationVersion.current;
          let loadedTopic: ForumTopic | null = null;
          let loadedVote: VoteType | null = null;
          if (mode !== 'more') {
            loadedTopic = await getForumTopic(topicId);
            if (!isActive()) return;
            if (!loadedTopic || loadedTopic.isDeleted) {
              setTopic(null);
              setErrorMessage(TOPIC_NOT_FOUND);
              return;
            }
            loadedVote = await getUserTopicVote(topicId, userId);
            if (!isActive()) return;
          }

          const page = await listTopicMessages(topicId, 50, mode === 'more' ? nextPage.current.cursor : null);
          if (!isActive()) return;
          const votes = await Promise.all(
            page.items.map((message) => getUserMessageVote(topicId, message.id, userId))
          );
          if (!isActive()) return;
          // A write may have started while these reads were in flight.
          if (version !== mutationVersion.current) continue;

          if (loadedTopic) {
            setTopic(loadedTopic);
            setTopicVote(loadedVote);
          }
          nextPage.current = { cursor: page.cursor, hasMore: page.hasMore, topicId };
          setHasMore(page.hasMore);
          setMessages((current) => {
            const combined = mode === 'more' ? [...current, ...page.items] : page.items;
            return [...new Map(combined.map((message) => [message.id, message])).values()]
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
          });
          const pageVotes = Object.fromEntries(page.items.map((message, index) => [message.id, votes[index]]));
          setMessageVotes((current) => mode === 'more' ? { ...current, ...pageVotes } : pageVotes);
          return;
        }
      } catch (error) {
        console.warn('[forum] Failed to load forum topic:', error);
        if (isActive()) {
          failedMode.current = mode;
          setErrorMessage(LOAD_ERROR);
        }
      } finally {
        if (isActive()) {
          pendingLoad.current = false;
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [topicId, userId]
  );

  useFocusEffect(
    useCallback(() => {
      void load('focus');
      return () => {
        requestId.current += 1;
        pendingLoad.current = false;
      };
    }, [load])
  );

  const refresh = useCallback(() => load('refresh'), [load]);
  const loadMore = useCallback(() => load('more'), [load]);
  const retry = useCallback(() => load(failedMode.current), [load]);

  const voteTopic = useCallback(
    async (voteType: VoteType) => {
      if (!topic || !userId || pendingVotes.current.has(topic.id)) return;

      const previousTopic = topic;
      const previousVote = topicVote;
      const next = applyVote(topic, previousVote, voteType);

      pendingVotes.current.add(topic.id);
      setTopic(next.item);
      setTopicVote(next.vote);

      await runMutation(async () => {
        try {
          await castTopicVote(topic.id, userId, voteType);
        } catch (error) {
          setTopic(previousTopic);
          setTopicVote(previousVote);
          throw error;
        } finally {
          pendingVotes.current.delete(topic.id);
        }
      });
    },
    [runMutation, topic, topicVote, userId]
  );

  const voteMessage = useCallback(
    async (messageId: string, voteType: VoteType) => {
      const message = messages.find((item) => item.id === messageId);
      if (!message || !userId || pendingVotes.current.has(messageId)) return;

      const previousVote = messageVotes[messageId] ?? null;
      const next = applyVote(message, previousVote, voteType);
      const replace = (value: ForumMessage) =>
        setMessages((current) => current.map((item) => (item.id === messageId ? value : item)));

      pendingVotes.current.add(messageId);
      replace(next.item);
      setMessageVotes((current) => ({ ...current, [messageId]: next.vote }));

      await runMutation(async () => {
        try {
          await castMessageVote(topicId, messageId, userId, voteType);
        } catch (error) {
          replace(message);
          setMessageVotes((current) => ({ ...current, [messageId]: previousVote }));
          throw error;
        } finally {
          pendingVotes.current.delete(messageId);
        }
      });
    },
    [messageVotes, messages, runMutation, topicId, userId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user) return;

      await runMutation(async () => {
        const message = await createForumMessage({
          topicId,
          authorId: user.id,
          authorSnapshot: { fullName: user.fullName, avatarUrl: user.avatarUrl ?? null },
          content,
        });

        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message]
        );
        setMessageVotes((current) => ({ ...current, [message.id]: null }));
        setTopic((current) =>
          current
            ? { ...current, repliesCount: current.repliesCount + 1, lastReplyAt: message.createdAt }
            : current
        );
      });
    },
    [runMutation, topicId, user]
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      await runMutation(async () => {
        await updateForumMessage(topicId, messageId, { content });
        const trimmed = content.trim();
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId ? { ...item, content: trimmed, updatedAt: new Date() } : item
          )
        );
      });
    },
    [runMutation, topicId]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      await runMutation(async () => {
        await softDeleteForumMessage(topicId, messageId);
        setMessages((current) => current.filter((item) => item.id !== messageId));
        setTopic((current) =>
          current ? { ...current, repliesCount: Math.max(0, current.repliesCount - 1) } : current
        );
      });
    },
    [runMutation, topicId]
  );

  const deleteTopic = useCallback(async () => {
    await runMutation(() => softDeleteForumTopic(topicId));
  }, [runMutation, topicId]);

  return {
    userId,
    topic,
    messages,
    topicVote,
    messageVotes,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    loadMore,
    retry,
    errorMessage,
    refresh,
    voteTopic,
    voteMessage,
    sendMessage,
    editMessage,
    deleteMessage,
    deleteTopic,
  };
}
