import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '@/services/firebase';

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

export async function listCityTopics(cityNormalized: string, sortBy: TopicFeedSort = 'recent', pageSize = 20): Promise<ForumTopic[]> {
  const constraints: QueryConstraint[] = [
    where('city_normalized', '==', cityNormalized),
    where('is_deleted', '==', false),
  ];

  if (sortBy === 'top') {
    constraints.push(orderBy('net_votes', 'desc'));
  } else {
    constraints.push(orderBy('is_pinned', 'desc'), orderBy('last_reply_at', 'desc'));
  }
  constraints.push(limit(pageSize));

  const snaps = await getDocs(query(collection(db, TOPICS_COLLECTION), ...constraints));
  return snaps.docs.map((d) => mapDocToForumTopic(d.id, d.data()));
}

export async function listRegionTopics(region: string, pageSize = 20): Promise<ForumTopic[]> {
  const snaps = await getDocs(
    query(
      collection(db, TOPICS_COLLECTION),
      where('region', '==', region),
      where('is_deleted', '==', false),
      orderBy('last_reply_at', 'desc'),
      limit(pageSize)
    )
  );
  return snaps.docs.map((d) => mapDocToForumTopic(d.id, d.data()));
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
  const now = new Date();

  const messageData = {
    topic_id: dto.topicId,
    author_id: dto.authorId,
    author_snapshot: toFirestoreAuthorSnapshot(dto.authorSnapshot),
    content: dto.content.trim(),
    upvotes_count: 0,
    downvotes_count: 0,
    net_votes: 0,
    is_deleted: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const messageRef = doc(collection(db, TOPICS_COLLECTION, dto.topicId, MESSAGES_SUBCOLLECTION));
  const topicRef = doc(db, TOPICS_COLLECTION, dto.topicId);

  const batch = writeBatch(db);
  batch.set(messageRef, messageData);
  batch.update(topicRef, {
    replies_count: increment(1),
    last_reply_at: serverTimestamp(),
  });
  await batch.commit();

  return mapDocToForumMessage(messageRef.id, dto.topicId, {
    ...messageData,
    created_at: now,
    updated_at: now,
  });
}

export async function getForumMessage(topicId: string, messageId: string): Promise<ForumMessage | null> {
  const snap = await getDoc(doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId));
  if (!snap.exists()) return null;
  return mapDocToForumMessage(snap.id, topicId, snap.data());
}

export async function listTopicMessages(topicId: string, pageSize = 50): Promise<ForumMessage[]> {
  const snaps = await getDocs(
    query(
      collection(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION),
      orderBy('created_at', 'asc'),
      limit(pageSize)
    )
  );
  return snaps.docs.map((d) => mapDocToForumMessage(d.id, topicId, d.data()));
}

export async function updateForumMessage(topicId: string, messageId: string, updates: UpdateForumMessageDTO): Promise<void> {
  await updateDoc(doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId), {
    content: updates.content.trim(),
    updated_at: serverTimestamp(),
  });
}

export async function softDeleteForumMessage(topicId: string, messageId: string): Promise<void> {
  const messageRef = doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId);
  const topicRef = doc(db, TOPICS_COLLECTION, topicId);

  // Read first so deleting an already-deleted message does not decrement the counter twice
  await runTransaction(db, async (transaction) => {
    const messageSnap = await transaction.get(messageRef);
    if (!messageSnap.exists() || messageSnap.data().is_deleted) return;

    transaction.update(messageRef, { is_deleted: true, updated_at: serverTimestamp() });
    transaction.update(topicRef, { replies_count: increment(-1) });
  });
}

// ---------- Votes ----------

async function runVoteTransaction(itemRef: DocumentReference<DocumentData>, voteRef: DocumentReference<DocumentData>, voteType: VoteType): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const voteSnap = await transaction.get(voteRef);

    let upvotesDelta = 0;
    let downvotesDelta = 0;
    let netDelta = 0;

    if (!voteSnap.exists()) {
      transaction.set(voteRef, { vote_type: voteType, created_at: serverTimestamp() });
      if (voteType === 'up') {
        upvotesDelta = 1;
        netDelta = 1;
      } else {
        downvotesDelta = 1;
        netDelta = -1;
      }
    } else {
      const existingType = voteSnap.data().vote_type as VoteType;

      if (existingType === voteType) {
        transaction.delete(voteRef);
        if (voteType === 'up') {
          upvotesDelta = -1;
          netDelta = -1;
        } else {
          downvotesDelta = -1;
          netDelta = 1;
        }
      } else {
        transaction.update(voteRef, { vote_type: voteType, created_at: serverTimestamp() });
        if (voteType === 'up') {
          upvotesDelta = 1;
          downvotesDelta = -1;
          netDelta = 2;
        } else {
          upvotesDelta = -1;
          downvotesDelta = 1;
          netDelta = -2;
        }
      }
    }

    transaction.update(itemRef, {
      upvotes_count: increment(upvotesDelta),
      downvotes_count: increment(downvotesDelta),
      net_votes: increment(netDelta),
    });
  });
}

export async function castTopicVote(topicId: string, userId: string, voteType: VoteType): Promise<void> {
  const topicRef = doc(db, TOPICS_COLLECTION, topicId);
  const voteRef = doc(db, TOPICS_COLLECTION, topicId, VOTES_SUBCOLLECTION, userId);
  await runVoteTransaction(topicRef, voteRef, voteType);
}

export async function getUserTopicVote(topicId: string, userId: string): Promise<VoteType | null> {
  const snap = await getDoc(doc(db, TOPICS_COLLECTION, topicId, VOTES_SUBCOLLECTION, userId));
  if (!snap.exists()) return null;
  return snap.data().vote_type as VoteType;
}

export async function castMessageVote(topicId: string, messageId: string, userId: string, voteType: VoteType): Promise<void> {
  const messageRef = doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId);
  const voteRef = doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId, VOTES_SUBCOLLECTION, userId);
  await runVoteTransaction(messageRef, voteRef, voteType);
}

export async function getUserMessageVote(topicId: string, messageId: string, userId: string): Promise<VoteType | null> {
  const snap = await getDoc(
    doc(db, TOPICS_COLLECTION, topicId, MESSAGES_SUBCOLLECTION, messageId, VOTES_SUBCOLLECTION, userId)
  );
  if (!snap.exists()) return null;
  return snap.data().vote_type as VoteType;
}
