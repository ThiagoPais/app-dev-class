import {
  collection,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/services/firebase';

import { DEFAULT_CHAT_PAGE_SIZE } from '../constants';
import type { Chat, OpenDirectChatDTO } from '../models';
import { buildDirectChatId } from '../utils/chat-id';
import { mapDocToChat, toFirestoreParticipant } from './chat.helpers';

const CHATS_COLLECTION = 'chats';
const MESSAGES_SUBCOLLECTION = 'chat_messages';

export type ChatCursor = QueryDocumentSnapshot | null;

export interface ChatPage<T> {
  items: T[];
  cursor: ChatCursor;
  hasMore: boolean;
}

async function readPage<T>(
  path: string[],
  constraints: QueryConstraint[],
  pageSize: number,
  cursor: ChatCursor,
  map: (snapshot: QueryDocumentSnapshot) => T
): Promise<ChatPage<T>> {
  if (cursor) constraints.push(startAfter(cursor));
  // The extra document tells the UI whether another page is available.
  constraints.push(limit(pageSize + 1));
  const [first, ...rest] = path;
  const snaps = await getDocs(query(collection(db, first, ...rest), ...constraints));
  const docs = snaps.docs.slice(0, pageSize);
  return {
    items: docs.map(map),
    cursor: docs.at(-1) ?? cursor,
    hasMore: snaps.size > pageSize,
  };
}

// ---------- Direct chats ----------

/**
 * Returns the direct chat between the two users, creating it if missing. The ID is
 * the canonical sorted pair, so concurrent creators converge on one document.
 */
export async function getOrCreateDirectChat(dto: OpenDirectChatDTO): Promise<Chat> {
  const { currentUser, otherUser } = dto;
  const chatId = buildDirectChatId(currentUser.userId, otherUser.userId);
  const userIds =
    currentUser.userId < otherUser.userId
      ? [currentUser.userId, otherUser.userId]
      : [otherUser.userId, currentUser.userId];
  const chatRef = doc(db, CHATS_COLLECTION, chatId);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chatRef);
    if (snap.exists()) return mapDocToChat(snap.id, snap.data());

    const chatData = {
      type: 'direct',
      user_ids: userIds,
      participants: {
        [currentUser.userId]: toFirestoreParticipant(currentUser.profile),
        [otherUser.userId]: toFirestoreParticipant(otherUser.profile),
      },
      name: null,
      avatar_url: null,
      created_by: null,
      admin_ids: [],
      last_message: null,
      unread_counts: { [currentUser.userId]: 0, [otherUser.userId]: 0 },
    };
    transaction.set(chatRef, {
      ...chatData,
      last_message_at: serverTimestamp(),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    const now = new Date();
    return mapDocToChat(chatId, {
      ...chatData,
      last_message_at: now,
      created_at: now,
      updated_at: now,
    });
  });
}

// ---------- Common ----------

export async function getChat(chatId: string): Promise<Chat | null> {
  const snap = await getDoc(doc(db, CHATS_COLLECTION, chatId));
  if (!snap.exists()) return null;
  return mapDocToChat(snap.id, snap.data());
}

export async function listUserChats(
  userId: string,
  pageSize = DEFAULT_CHAT_PAGE_SIZE,
  cursor: ChatCursor = null
): Promise<ChatPage<Chat>> {
  return readPage(
    [CHATS_COLLECTION],
    [where('user_ids', 'array-contains', userId), orderBy('last_message_at', 'desc')],
    pageSize,
    cursor,
    (d) => mapDocToChat(d.id, d.data())
  );
}

/**
 * Live view of the user's chats (same query as `listUserChats`, without paging).
 * Calls `onChange` with the full current list, newest activity first.
 */
export function subscribeToUserChats(
  userId: string,
  onChange: (chats: Chat[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const chatsQuery = query(
    collection(db, CHATS_COLLECTION),
    where('user_ids', 'array-contains', userId),
    orderBy('last_message_at', 'desc')
  );
  return onSnapshot(
    chatsQuery,
    (snaps) => onChange(snaps.docs.map((d) => mapDocToChat(d.id, d.data()))),
    onError
  );
}

export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  await updateDoc(
    doc(db, CHATS_COLLECTION, chatId),
    new FieldPath('unread_counts', userId),
    0,
    'updated_at',
    serverTimestamp()
  );
}
