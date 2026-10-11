import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/domains/auth';
import { showAlert } from '@/shared/utils/dialogs';

import { SUBSCRIBED_CHATS_LIMIT } from '../constants';
import type { Chat, ChatSummary } from '../models';
import { listUserChats, subscribeToUserChats, type ChatCursor } from '../services/chat.service';

const LOAD_ERROR = 'Não foi possível carregar suas conversas.';

function getPreview(chat: Chat, myId: string): string {
  const last = chat.lastMessage;
  if (!last) return 'Nenhuma mensagem ainda';
  if (last.isDeleted) return 'Mensagem apagada';
  if (last.authorId === myId) return `Você: ${last.message}`;
  if (chat.type === 'group') {
    const firstName = chat.participants[last.authorId]?.fullName.split(' ')[0];
    if (firstName) return `${firstName}: ${last.message}`;
  }
  return last.message;
}

function toSummary(chat: Chat, myId: string): ChatSummary {
  const otherId = chat.type === 'direct' ? chat.userIds.find((id) => id !== myId) : undefined;
  const other = otherId ? chat.participants[otherId] : undefined;
  return {
    id: chat.id,
    title: (other ? other.fullName : chat.name) || 'Usuário',
    avatarUrl: other ? other.avatarUrl : chat.avatarUrl,
    preview: getPreview(chat, myId),
    lastMessageAt: chat.lastMessageAt,
    unreadCount: chat.unreadCounts[myId] ?? 0,
    contact: otherId && other ? { id: otherId, ...other } : null,
  };
}

/**
 * The signed-in user's chats, newest activity first. The newest
 * SUBSCRIBED_CHATS_LIMIT stay live; older ones are paged on demand.
 */
export function useUserChats() {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [live, setLive] = useState<Chat[]>([]);
  const [older, setOlder] = useState<Chat[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<ChatCursor>(null);
  const pendingMore = useRef(false);

  useEffect(() => {
    if (!myId) return;
    return subscribeToUserChats(
      myId,
      (chats) => {
        setLive(chats);
        setErrorMessage(null);
        setIsLoading(false);
      },
      (error) => {
        console.warn('[chat] Failed to load chats:', error);
        setErrorMessage(LOAD_ERROR);
        setIsLoading(false);
      }
    );
  }, [attempt, myId]);

  // Until older pages are fetched, a full live window means there may be more.
  const hasMore = olderHasMore ?? live.length >= SUBSCRIBED_CHATS_LIMIT;

  const items = useMemo(() => {
    if (!myId) return [];
    const liveIds = new Set(live.map((chat) => chat.id));
    return [...live, ...older.filter((chat) => !liveIds.has(chat.id))]
      // Opening a profile's chat creates it; hide direct chats nobody wrote in.
      .filter((chat) => chat.type === 'group' || chat.lastMessage)
      .map((chat) => toSummary(chat, myId));
  }, [live, myId, older]);

  const loadMore = useCallback(async () => {
    if (!myId || !hasMore || pendingMore.current) return;
    pendingMore.current = true;
    setIsLoadingMore(true);
    try {
      if (!cursor.current) {
        // Skip past the chats the live listener already covers.
        cursor.current = (await listUserChats(myId, SUBSCRIBED_CHATS_LIMIT)).cursor;
      }
      const page = await listUserChats(myId, undefined, cursor.current);
      cursor.current = page.cursor;
      setOlderHasMore(page.hasMore);
      setOlder((current) => [
        ...new Map([...current, ...page.items].map((chat) => [chat.id, chat])).values(),
      ]);
    } catch (error) {
      console.warn('[chat] Failed to load older chats:', error);
      showAlert('Não foi possível carregar mais conversas.');
    } finally {
      pendingMore.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, myId]);

  const retry = useCallback(() => {
    setErrorMessage(null);
    setIsLoading(true);
    setAttempt((current) => current + 1);
  }, []);

  return { items, isLoading, isLoadingMore, hasMore, errorMessage, loadMore, retry };
}
