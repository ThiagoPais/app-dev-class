import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '@/services/firebase';

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
