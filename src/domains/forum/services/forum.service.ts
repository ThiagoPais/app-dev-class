import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';

import { getFunctions, httpsCallable } from 'firebase/functions';

import { app, auth, db } from '@/services/firebase';

import type {
  AuthorSnapshot,
  CreateForumMessageDTO,
  CreateForumTopicDTO,
  ForumMessage,
  ForumTopic,
  TopicFeedSort,
  UpdateForumMessageDTO,
  UpdateForumTopicDTO,
  VoteType,
} from '../models/forumTypes';

const TOPICS_COLLECTION = 'forum_topics';
const MESSAGES_SUBCOLLECTION = 'messages';
const VOTES_SUBCOLLECTION = 'votes';

export type ForumCursor = QueryDocumentSnapshot | null;

export interface ForumPage<T> {
  items: T[];
  cursor: ForumCursor;
  hasMore: boolean;
}

async function readPage<T>(
  path: string[],
  constraints: QueryConstraint[],
  pageSize: number,
  cursor: ForumCursor,
  map: (snapshot: QueryDocumentSnapshot) => T
): Promise<ForumPage<T>> {
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

function toDate(value: Timestamp | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value) return value.toDate();
  return new Date();
}

export function normalizeCityName(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function toFirestoreAuthorSnapshot(snapshot: AuthorSnapshot) {
  return {
    full_name: snapshot.fullName,
    avatar_url: snapshot.avatarUrl,
  };
}

function mapAuthorSnapshot(data: Record<string, unknown> | undefined): AuthorSnapshot {
  return {
    fullName: (data?.full_name as string) ?? '',
    avatarUrl: (data?.avatar_url as string | null) ?? null,
  };
}

function mapDocToForumTopic(id: string, data: Record<string, unknown>): ForumTopic {
  return {
    id,
    authorId: data.author_id as string,
    authorSnapshot: mapAuthorSnapshot(data.author_snapshot as Record<string, unknown>),
    title: data.title as string,
    content: data.content as string,
    region: data.region as string,
    city: data.city as string,
    cityNormalized: data.city_normalized as string,
    upvotesCount: (data.upvotes_count as number) ?? 0,
    downvotesCount: (data.downvotes_count as number) ?? 0,
    netVotes: (data.net_votes as number) ?? 0,
    repliesCount: (data.replies_count as number) ?? 0,
    isPinned: (data.is_pinned as boolean) ?? false,
    isLocked: (data.is_locked as boolean) ?? false,
    isDeleted: (data.is_deleted as boolean) ?? false,
    lastReplyAt: toDate(data.last_reply_at as Timestamp),
    createdAt: toDate(data.created_at as Timestamp),
    updatedAt: toDate(data.updated_at as Timestamp),
  };
}

function mapDocToForumMessage(id: string, topicId: string, data: Record<string, unknown>): ForumMessage {
  return {
    id,
    topicId,
    authorId: data.author_id as string,
    authorSnapshot: mapAuthorSnapshot(data.author_snapshot as Record<string, unknown>),
    content: data.content as string,
    upvotesCount: (data.upvotes_count as number) ?? 0,
    downvotesCount: (data.downvotes_count as number) ?? 0,
    netVotes: (data.net_votes as number) ?? 0,
    isDeleted: (data.is_deleted as boolean) ?? false,
    createdAt: toDate(data.created_at as Timestamp),
    updatedAt: toDate(data.updated_at as Timestamp),
  };
}

// ---------- Forum Topics ----------

export async function createForumTopic(dto: CreateForumTopicDTO): Promise<ForumTopic> {
  const now = new Date();

  const topicData = {
    author_id: dto.authorId,
    author_snapshot: toFirestoreAuthorSnapshot(dto.authorSnapshot),
    title: dto.title.trim(),
    content: dto.content.trim(),
    region: dto.region,
    city: dto.city,
    city_normalized: normalizeCityName(dto.city),
    upvotes_count: 0,
    downvotes_count: 0,
    net_votes: 0,
    replies_count: 0,
    is_pinned: false,
    is_locked: false,
    is_deleted: false,
    last_reply_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const topicRef = await addDoc(collection(db, TOPICS_COLLECTION), topicData);

  return mapDocToForumTopic(topicRef.id, {
    ...topicData,
    last_reply_at: now,
    created_at: now,
    updated_at: now,
  });
}

export async function getForumTopic(topicId: string): Promise<ForumTopic | null> {
  const snap = await getDoc(doc(db, TOPICS_COLLECTION, topicId));
  if (!snap.exists()) return null;
  return mapDocToForumTopic(snap.id, snap.data());
}

export async function listCityTopics(
  cityNormalized: string,
  sortBy: TopicFeedSort = 'recent',
  pageSize = 20,
  cursor: ForumCursor = null
): Promise<ForumPage<ForumTopic>> {
  const constraints: QueryConstraint[] = [
    where('city_normalized', '==', cityNormalized),
    where('is_deleted', '==', false),
  ];

  if (sortBy === 'top') {
    constraints.push(orderBy('net_votes', 'desc'));
  } else {
    constraints.push(orderBy('is_pinned', 'desc'), orderBy('last_reply_at', 'desc'));
  }
  return readPage([TOPICS_COLLECTION], constraints, pageSize, cursor,
    (d) => mapDocToForumTopic(d.id, d.data()));
}

export async function listRegionTopics(
  region: string,
  pageSize = 20,
  cursor: ForumCursor = null
): Promise<ForumPage<ForumTopic>> {
  return readPage(
    [TOPICS_COLLECTION],
    [
      where('region', '==', region),
      where('is_deleted', '==', false),
      orderBy('last_reply_at', 'desc'),
    ],
    pageSize,
    cursor,
    (d) => mapDocToForumTopic(d.id, d.data())
  );
}

/** Scan cursor pages until a match or the end, retaining only matching topics. */
export async function getTopicFeedPage(
  region: string,
  city: string | null,
  search: string,
  cursor: ForumCursor = null,
  isActive: () => boolean = () => true
): Promise<ForumPage<ForumTopic>> {
  const term = normalizeCityName(search);
  while (isActive()) {
    const page = city
      ? await listCityTopics(normalizeCityName(city), 'recent', 20, cursor)
      : await listRegionTopics(region, 30, cursor);
    const items = term
      ? page.items.filter((topic) =>
          [topic.title, topic.content, topic.city].some((field) =>
            normalizeCityName(field).includes(term)
          ))
      : page.items;
    if (items.length || !page.hasMore) return { ...page, items };
    cursor = page.cursor;
  }
  return { items: [], cursor, hasMore: false };
}

export async function listAuthorTopics(authorId: string, pageSize = 20): Promise<ForumTopic[]> {
  const snaps = await getDocs(
    query(
      collection(db, TOPICS_COLLECTION),
      where('author_id', '==', authorId),
      orderBy('created_at', 'desc'),
      limit(pageSize)
    )
  );
  return snaps.docs.map((d) => mapDocToForumTopic(d.id, d.data()));
}

export async function updateForumTopic(topicId: string, updates: UpdateForumTopicDTO): Promise<void> {
  const data: Record<string, unknown> = { updated_at: serverTimestamp() };
  if (updates.title !== undefined) data.title = updates.title.trim();
  if (updates.content !== undefined) data.content = updates.content.trim();

  await updateDoc(doc(db, TOPICS_COLLECTION, topicId), data);
}

export async function softDeleteForumTopic(topicId: string): Promise<void> {
  await updateDoc(doc(db, TOPICS_COLLECTION, topicId), {
    is_deleted: true,
    updated_at: serverTimestamp(),
  });
}

// ---------- Forum Messages ----------

export async function createForumMessage(dto: CreateForumMessageDTO): Promise<ForumMessage> {
  if (dto.authorId !== auth.currentUser?.uid) throw new Error('Autor inválido.');
  const createMessage = httpsCallable<
    { topicId: string; content: string },
    Record<string, unknown> & { id: string; created_at: number; updated_at: number }
  >(getFunctions(app), 'createForumMessage');
  const { data } = await createMessage({ topicId: dto.topicId, content: dto.content });
  return mapDocToForumMessage(data.id, dto.topicId, {
    ...data,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  });
}

export async function getForumMessage(topicId: string, messageId: string): Promise<ForumMessage | null> {
  const snap = await getDoc(doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId));
  if (!snap.exists()) return null;
  return mapDocToForumMessage(snap.id, topicId, snap.data());
}

export async function listTopicMessages(
  topicId: string,
  pageSize = 50,
  cursor: ForumCursor = null
): Promise<ForumPage<ForumMessage>> {
  return readPage(
    [TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION],
    [
      where('is_deleted', '==', false),
      orderBy('created_at', 'asc'),
    ],
    pageSize,
    cursor,
    (d) => mapDocToForumMessage(d.id, topicId, d.data())
  );
}

export async function updateForumMessage(topicId: string, messageId: string, updates: UpdateForumMessageDTO): Promise<void> {
  await updateDoc(doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId), {
    content: updates.content.trim(),
    updated_at: serverTimestamp(),
  });
}

export async function softDeleteForumMessage(topicId: string, messageId: string): Promise<void> {
  const deleteMessage = httpsCallable(getFunctions(app), 'deleteForumMessage');
  await deleteMessage({ topicId, messageId });
}

// ---------- Votes ----------

export async function castTopicVote(topicId: string, userId: string, voteType: VoteType): Promise<void> {
  if (userId !== auth.currentUser?.uid) throw new Error('Usuário inválido.');
  const castVote = httpsCallable(getFunctions(app), 'castForumVote');
  await castVote({ topicId, voteType });
}

export async function getUserTopicVote(topicId: string, userId: string): Promise<VoteType | null> {
  const snap = await getDoc(doc(db, TOPICS_COLLECTION, topicId, VOTES_SUBCOLLECTION, userId));
  if (!snap.exists()) return null;
  return snap.data().vote_type as VoteType;
}

export async function castMessageVote(topicId: string, messageId: string, userId: string, voteType: VoteType): Promise<void> {
  if (userId !== auth.currentUser?.uid) throw new Error('Usuário inválido.');
  const castVote = httpsCallable(getFunctions(app), 'castForumVote');
  await castVote({ topicId, messageId, voteType });
}

export async function getUserMessageVote(topicId: string, messageId: string, userId: string): Promise<VoteType | null> {
  const snap = await getDoc(
    doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId, VOTES_SUBCOLLECTION, userId)
  );
  if (!snap.exists()) return null;
  return snap.data().vote_type as VoteType;
}
