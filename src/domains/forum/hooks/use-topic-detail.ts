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

  const userId = user?.id ?? null;

  const load = useCallback(
    async (mode: 'focus' | 'refresh') => {
      if (!userId) return;
      if (mode === 'refresh') setIsRefreshing(true);

      try {
        const [loadedTopic, loadedMessages, loadedTopicVote] = await Promise.all([
          getForumTopic(topicId),
          listTopicMessages(topicId),
          getUserTopicVote(topicId, userId),
        ]);

        if (!loadedTopic || loadedTopic.isDeleted) {
          setTopic(null);
          setErrorMessage(TOPIC_NOT_FOUND);
          return;
        }

        const visibleMessages = loadedMessages.filter((message) => !message.isDeleted);
        const votes = await Promise.all(
          visibleMessages.map((message) => getUserMessageVote(topicId, message.id, userId))
        );

        setTopic(loadedTopic);
        setMessages(visibleMessages);
        setTopicVote(loadedTopicVote);
        setMessageVotes(
          Object.fromEntries(visibleMessages.map((message, index) => [message.id, votes[index]]))
        );
        setErrorMessage(null);
      } catch (error) {
        // Firestore puts the link to create a missing index in this message
        console.warn('[forum] Failed to load forum topic:', error);
        setErrorMessage(LOAD_ERROR);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [topicId, userId]
  );

  useFocusEffect(
    useCallback(() => {
      void load('focus');
    }, [load])
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  const voteTopic = useCallback(
    async (voteType: VoteType) => {
      if (!topic || !userId || pendingVotes.current.has(topic.id)) return;

      const previousTopic = topic;
      const previousVote = topicVote;
      const next = applyVote(topic, previousVote, voteType);

      pendingVotes.current.add(topic.id);
      setTopic(next.item);
      setTopicVote(next.vote);

      try {
        await castTopicVote(topic.id, userId, voteType);
      } catch (error) {
        setTopic(previousTopic);
        setTopicVote(previousVote);
        throw error;
      } finally {
        pendingVotes.current.delete(topic.id);
      }
    },
    [topic, topicVote, userId]
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

      try {
        await castMessageVote(topicId, messageId, userId, voteType);
      } catch (error) {
        replace(message);
        setMessageVotes((current) => ({ ...current, [messageId]: previousVote }));
        throw error;
      } finally {
        pendingVotes.current.delete(messageId);
      }
    },
    [messageVotes, messages, topicId, userId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user) return;

      const message = await createForumMessage({
        topicId,
        authorId: user.id,
        authorSnapshot: { fullName: user.fullName, avatarUrl: user.avatarUrl ?? null },
        content,
      });

      setMessages((current) => [...current, message]);
      setMessageVotes((current) => ({ ...current, [message.id]: null }));
      setTopic((current) =>
        current
          ? { ...current, repliesCount: current.repliesCount + 1, lastReplyAt: message.createdAt }
          : current
      );
    },
    [topicId, user]
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      await updateForumMessage(topicId, messageId, { content });
      const trimmed = content.trim();
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, content: trimmed, updatedAt: new Date() } : item
        )
      );
    },
    [topicId]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      await softDeleteForumMessage(topicId, messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
      setTopic((current) =>
        current ? { ...current, repliesCount: Math.max(0, current.repliesCount - 1) } : current
      );
    },
    [topicId]
  );

  const deleteTopic = useCallback(async () => {
    await softDeleteForumTopic(topicId);
  }, [topicId]);

  return {
    userId,
    topic,
    messages,
    topicVote,
    messageVotes,
    isLoading,
    isRefreshing,
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
