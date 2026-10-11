import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/domains/auth';
import { showAlert } from '@/shared/utils/dialogs';

import type { ChatMessage, ChatContact, ConversationMessage } from '../models';
import {
  getOrCreateDirectChat,
  listChatMessages,
  markChatAsRead,
  sendChatMessage,
  subscribeToChatMessages,
  type ChatCursor,
} from '../services/chat.service';

const LOAD_ERROR = 'Não foi possível carregar a conversa. Tente novamente.';

/** Direct chats only hold text messages; system and deleted ones are skipped. */
function toConversationMessage(message: ChatMessage): ConversationMessage | null {
  if (message.type !== 'text' || message.isDeleted) return null;
  if (!message.authorId || message.message === null) return null;
  return {
    id: message.id,
    senderId: message.authorId,
    text: message.message,
    sentAt: message.createdAt,
  };
}

/**
 * One-to-one conversation with `participant`. Opens (or creates) the direct
 * chat, keeps the newest page of messages live and loads older pages on demand.
 */
export function useDirectChat(participant: ChatContact) {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const myName = user?.fullName ?? '';
  const myAvatarUrl = user?.avatarUrl ?? null;
  const [chatId, setChatId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Record<string, ChatMessage>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<ChatCursor>(null);
  const pendingMore = useRef(false);

  // Live snapshots and older pages overlap, so everything is merged by ID.
  const merge = useCallback((items: ChatMessage[]) => {
    setLoaded((current) => {
      const next = { ...current };
      for (const item of items) next[item.id] = item;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!myId) return;
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    const fail = (error: unknown) => {
      console.warn('[chat] Failed to load conversation:', error);
      if (!isActive) return;
      setErrorMessage(LOAD_ERROR);
      setIsLoading(false);
    };

    const open = async () => {
      const chat = await getOrCreateDirectChat({
        currentUser: { userId: myId, profile: { fullName: myName, avatarUrl: myAvatarUrl } },
        otherUser: {
          userId: participant.id,
          profile: { fullName: participant.fullName, avatarUrl: participant.avatarUrl },
        },
      });
      if (!isActive) return;
      // The first page provides the cursor for older messages; the
      // subscription below keeps that same window up to date.
      const page = await listChatMessages(chat.id);
      if (!isActive) return;
      cursor.current = page.cursor;
      setHasMore(page.hasMore);
      merge(page.items);
      setChatId(chat.id);
      setIsLoading(false);
      unsubscribe = subscribeToChatMessages(chat.id, merge, fail);
    };

    open().catch(fail);

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [
    attempt,
    merge,
    myAvatarUrl,
    myId,
    myName,
    participant.avatarUrl,
    participant.fullName,
    participant.id,
  ]);

  const messages = useMemo(
    () =>
      Object.values(loaded)
        .map(toConversationMessage)
        .filter((message) => message !== null)
        .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime() || a.id.localeCompare(b.id)),
    [loaded]
  );
  const newestId = messages.at(-1)?.id;

  useEffect(() => {
    if (!chatId || !myId) return;
    markChatAsRead(chatId, myId).catch((error) =>
      console.warn('[chat] Failed to mark chat as read:', error)
    );
  }, [chatId, myId, newestId]);

  const loadMore = useCallback(async () => {
    if (!chatId || !hasMore || pendingMore.current) return;
    pendingMore.current = true;
    setIsLoadingMore(true);
    try {
      const page = await listChatMessages(chatId, undefined, cursor.current);
      cursor.current = page.cursor;
      setHasMore(page.hasMore);
      merge(page.items);
    } catch (error) {
      console.warn('[chat] Failed to load older messages:', error);
      showAlert('Não foi possível carregar mensagens anteriores.');
    } finally {
      pendingMore.current = false;
      setIsLoadingMore(false);
    }
  }, [chatId, hasMore, merge]);

  const retry = useCallback(() => {
    setErrorMessage(null);
    setIsLoading(true);
    setAttempt((current) => current + 1);
  }, []);

  /** Rejects if the write fails; the subscription renders the sent message. */
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!chatId || !myId || !trimmed) return;
      await sendChatMessage({
        chatId,
        authorId: myId,
        authorSnapshot: { fullName: myName, avatarUrl: myAvatarUrl },
        message: trimmed,
      });
    },
    [chatId, myAvatarUrl, myId, myName]
  );

  return {
    myId,
    messages,
    canSend: Boolean(chatId),
    isLoading,
    isLoadingMore,
    hasMore,
    errorMessage,
    loadMore,
    retry,
    send,
  };
}
