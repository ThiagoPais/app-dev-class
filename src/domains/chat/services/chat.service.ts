import {
  collection,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { auth, db } from '@/services/firebase';

import {
  DEFAULT_CHAT_PAGE_SIZE,
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MIN_GROUP_MEMBERS,
  SUBSCRIBED_CHATS_LIMIT,
} from '../constants';
import type {
  AddGroupMembersDTO,
  Chat,
  ChatMessage,
  ChatSystemEventKind,
  CreateGroupChatDTO,
  MemberInput,
  OpenDirectChatDTO,
  SendChatMessageDTO,
} from '../models';
import { ChatError } from '../utils/chat-error';
import { buildDirectChatId } from '../utils/chat-id';
import {
  applyAdminSuccession,
  assertAdmin,
  assertGroup,
  assertMember,
  mapDocToChat,
  mapDocToChatMessage,
  systemMessageData,
  toFirestoreParticipant,
  truncatePreview,
} from './chat.helpers';

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
 * Live view of the user's most recent chats (same query as `listUserChats`, capped at
 * SUBSCRIBED_CHATS_LIMIT). Calls `onChange` with the full current list, newest first.
 */
export function subscribeToUserChats(
  userId: string,
  onChange: (chats: Chat[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const chatsQuery = query(
    collection(db, CHATS_COLLECTION),
    where('user_ids', 'array-contains', userId),
    orderBy('last_message_at', 'desc'),
    limit(SUBSCRIBED_CHATS_LIMIT)
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

// ---------- Messages ----------

/**
 * Sends a text message: creates it and updates the chat preview, activity time and the
 * unread counter of every other member in one batch. Validation and the membership check
 * run before any write.
 */
export async function sendChatMessage(dto: SendChatMessageDTO): Promise<ChatMessage> {
  const message = dto.message.trim();
  if (!message) throw new ChatError('CHAT_MESSAGE_EMPTY');
  if (message.length > MAX_MESSAGE_LENGTH) throw new ChatError('CHAT_MESSAGE_TOO_LONG');

  const chat = await getChat(dto.chatId);
  if (!chat) throw new ChatError('CHAT_NOT_FOUND');
  assertMember(chat, dto.authorId);

  const chatRef = doc(db, CHATS_COLLECTION, dto.chatId);
  const messageRef = doc(collection(chatRef, MESSAGES_SUBCOLLECTION));
  const messageData = {
    chat_id: dto.chatId,
    type: 'text',
    author_id: dto.authorId,
    author_snapshot: toFirestoreParticipant(dto.authorSnapshot),
    message,
    system_event: null,
    is_deleted: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const unreadIncrements = chat.userIds
    .filter((userId) => userId !== dto.authorId)
    .flatMap((userId) => [new FieldPath('unread_counts', userId), increment(1)]);

  const batch = writeBatch(db);
  batch.set(messageRef, messageData);
  batch.update(
    chatRef,
    'last_message',
    {
      message_id: messageRef.id,
      author_id: dto.authorId,
      message: truncatePreview(message),
      created_at: serverTimestamp(),
      is_deleted: false,
    },
    'last_message_at',
    serverTimestamp(),
    'updated_at',
    serverTimestamp(),
    ...unreadIncrements
  );
  await batch.commit();

  const now = new Date();
  return mapDocToChatMessage(messageRef.id, dto.chatId, {
    ...messageData,
    created_at: now,
    updated_at: now,
  });
}

/** Newest first; soft-deleted and system messages are included (the thread renders them). */
export async function listChatMessages(
  chatId: string,
  pageSize = DEFAULT_MESSAGE_PAGE_SIZE,
  cursor: ChatCursor = null
): Promise<ChatPage<ChatMessage>> {
  return readPage(
    [CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION],
    [orderBy('created_at', 'desc')],
    pageSize,
    cursor,
    (d) => mapDocToChatMessage(d.id, chatId, d.data())
  );
}

/** Live view of the newest page of a chat's messages, newest first. Older pages: `listChatMessages`. */
export function subscribeToChatMessages(
  chatId: string,
  onChange: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
  pageSize = DEFAULT_MESSAGE_PAGE_SIZE
): Unsubscribe {
  const messagesQuery = query(
    collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION),
    orderBy('created_at', 'desc'),
    limit(pageSize)
  );
  return onSnapshot(
    messagesQuery,
    (snaps) => onChange(snaps.docs.map((d) => mapDocToChatMessage(d.id, chatId, d.data()))),
    onError
  );
}

/**
 * Author-only edit of a text message. If it is the chat's latest message, the preview is
 * refreshed too; `last_message_at` is left alone so the chat list order does not move.
 */
export async function updateChatMessage(
  chatId: string,
  messageId: string,
  message: string
): Promise<void> {
  const body = message.trim();
  if (!body) throw new ChatError('CHAT_MESSAGE_EMPTY');
  if (body.length > MAX_MESSAGE_LENGTH) throw new ChatError('CHAT_MESSAGE_TOO_LONG');

  const userId = auth.currentUser?.uid;
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const messageRef = doc(chatRef, MESSAGES_SUBCOLLECTION, messageId);

  await runTransaction(db, async (transaction) => {
    const chatSnap = await transaction.get(chatRef);
    const messageSnap = await transaction.get(messageRef);
    if (!chatSnap.exists() || !messageSnap.exists() || messageSnap.data().is_deleted) {
      throw new ChatError('CHAT_NOT_FOUND');
    }
    const data = messageSnap.data();
    if (data.type !== 'text' || !userId || data.author_id !== userId) {
      throw new ChatError('CHAT_NOT_AUTHOR');
    }

    transaction.update(messageRef, { message: body, updated_at: serverTimestamp() });
    if (chatSnap.data().last_message?.message_id === messageId) {
      transaction.update(
        chatRef,
        'last_message.message',
        truncatePreview(body),
        'updated_at',
        serverTimestamp()
      );
    }
  });
}

/**
 * Author-only soft delete (never a hard delete). If it is the chat's latest message the
 * preview is marked deleted and its text cleared. Already-deleted messages are a no-op,
 * so retries are safe.
 */
export async function softDeleteChatMessage(chatId: string, messageId: string): Promise<void> {
  const userId = auth.currentUser?.uid;
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const messageRef = doc(chatRef, MESSAGES_SUBCOLLECTION, messageId);

  await runTransaction(db, async (transaction) => {
    const chatSnap = await transaction.get(chatRef);
    const messageSnap = await transaction.get(messageRef);
    if (!chatSnap.exists() || !messageSnap.exists()) throw new ChatError('CHAT_NOT_FOUND');
    const data = messageSnap.data();
    if (data.type !== 'text' || !userId || data.author_id !== userId) {
      throw new ChatError('CHAT_NOT_AUTHOR');
    }
    if (data.is_deleted) return;

    transaction.update(messageRef, { is_deleted: true, updated_at: serverTimestamp() });
    if (chatSnap.data().last_message?.message_id === messageId) {
      transaction.update(
        chatRef,
        'last_message.is_deleted',
        true,
        'last_message.message',
        '',
        'updated_at',
        serverTimestamp()
      );
    }
  });
}

// ---------- Group chats ----------

/**
 * Creates a group: the creator is first in `user_ids` (join order) and its only admin.
 * The `group_created` system message is written in the same batch and never touches the
 * preview or the unread counters.
 */
export async function createGroupChat(dto: CreateGroupChatDTO): Promise<Chat> {
  const name = dto.name.trim();
  if (!name || name.length > MAX_GROUP_NAME_LENGTH) throw new ChatError('CHAT_GROUP_NAME_INVALID');

  const { creator } = dto;
  const others = new Map<string, MemberInput>();
  for (const member of dto.members) {
    if (member.userId !== creator.userId && !others.has(member.userId)) {
      others.set(member.userId, member);
    }
  }
  const members = [creator, ...others.values()];
  if (members.length < MIN_GROUP_MEMBERS) throw new ChatError('CHAT_GROUP_TOO_SMALL');
  if (members.length > MAX_GROUP_MEMBERS) throw new ChatError('CHAT_GROUP_FULL');

  const chatRef = doc(collection(db, CHATS_COLLECTION));
  const chatData = {
    type: 'group',
    user_ids: members.map((member) => member.userId),
    participants: Object.fromEntries(
      members.map((member) => [member.userId, toFirestoreParticipant(member.profile)])
    ),
    name,
    avatar_url: dto.avatarUrl ?? null,
    created_by: creator.userId,
    admin_ids: [creator.userId],
    last_message: null,
    unread_counts: Object.fromEntries(members.map((member) => [member.userId, 0])),
  };

  const batch = writeBatch(db);
  batch.set(chatRef, {
    ...chatData,
    last_message_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  batch.set(
    doc(collection(chatRef, MESSAGES_SUBCOLLECTION)),
    systemMessageData(chatRef.id, 'group_created', creator.userId, [])
  );
  await batch.commit();

  // Re-read so the returned chat carries the resolved server timestamps. The group is
  // already committed, so a failed or empty read must not surface as an error (a retry
  // would create a duplicate group): fall back to the local copy.
  const created = await getChat(chatRef.id).catch(() => null);
  if (created) return created;
  const now = new Date();
  return mapDocToChat(chatRef.id, {
    ...chatData,
    last_message_at: now,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Admin-only. Appends the new members to `user_ids` (join order), adds their participant
 * snapshot and a zero unread counter, and writes one `member_added` system message.
 * Members already in the group are ignored; nothing is written if nobody is new.
 */
export async function addGroupMembers(dto: AddGroupMembersDTO): Promise<void> {
  const chatRef = doc(db, CHATS_COLLECTION, dto.chatId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chatRef);
    if (!snap.exists()) throw new ChatError('CHAT_NOT_FOUND');
    const chat = mapDocToChat(snap.id, snap.data());
    assertGroup(chat);
    assertAdmin(chat, dto.actorId);

    const added = new Map<string, MemberInput>();
    for (const member of dto.members) {
      if (!chat.userIds.includes(member.userId) && !added.has(member.userId)) {
        added.set(member.userId, member);
      }
    }
    if (added.size === 0) return;
    if (chat.userIds.length + added.size > MAX_GROUP_MEMBERS) throw new ChatError('CHAT_GROUP_FULL');

    const newMembers = [...added.values()];
    const newIds = newMembers.map((member) => member.userId);
    const memberEntries = newMembers.flatMap((member) => [
      new FieldPath('participants', member.userId),
      toFirestoreParticipant(member.profile),
      new FieldPath('unread_counts', member.userId),
      0,
    ]);

    transaction.update(
      chatRef,
      'user_ids',
      [...chat.userIds, ...newIds],
      'updated_at',
      serverTimestamp(),
      ...memberEntries
    );
    transaction.set(
      doc(collection(chatRef, MESSAGES_SUBCOLLECTION)),
      systemMessageData(chatRef.id, 'member_added', dto.actorId, newIds)
    );
  });
}

/**
 * Shared body of `removeGroupMember` / `leaveGroupChat`: drops the member from `user_ids`
 * (order of the others preserved) and `admin_ids`, deletes their participant and unread
 * entries, and writes the system message(s). If no admin is left while members remain, the
 * oldest remaining member is promoted in the same transaction (`admin_promoted`).
 * `authorize` runs on the freshly read group.
 */
async function removeMember(
  chatId: string,
  actorId: string,
  targetId: string,
  kind: Extract<ChatSystemEventKind, 'member_removed' | 'member_left'>,
  authorize: (chat: Chat) => void
): Promise<void> {
  const chatRef = doc(db, CHATS_COLLECTION, chatId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chatRef);
    if (!snap.exists()) throw new ChatError('CHAT_NOT_FOUND');
    const chat = mapDocToChat(snap.id, snap.data());
    assertGroup(chat);
    authorize(chat);

    const userIds = chat.userIds.filter((userId) => userId !== targetId);
    // Also drops the removed member from the admins; promotes the oldest remaining member
    // when that leaves the group with members but no admin.
    const { adminIds, promoted } = applyAdminSuccession(userIds, chat.adminIds);

    transaction.update(
      chatRef,
      'user_ids',
      userIds,
      'admin_ids',
      adminIds,
      new FieldPath('participants', targetId),
      deleteField(),
      new FieldPath('unread_counts', targetId),
      deleteField(),
      'updated_at',
      serverTimestamp()
    );
    transaction.set(
      doc(collection(chatRef, MESSAGES_SUBCOLLECTION)),
      systemMessageData(chatRef.id, kind, actorId, [targetId])
    );
    if (promoted) {
      transaction.set(
        doc(collection(chatRef, MESSAGES_SUBCOLLECTION)),
        systemMessageData(chatRef.id, 'admin_promoted', actorId, [promoted])
      );
    }
  });
}

/** Admin-only. An admin cannot remove themselves: they use `leaveGroupChat`. */
export async function removeGroupMember(
  chatId: string,
  actorId: string,
  targetId: string
): Promise<void> {
  await removeMember(chatId, actorId, targetId, 'member_removed', (chat) => {
    assertAdmin(chat, actorId);
    if (targetId === actorId) throw new ChatError('CHAT_SELF_NOT_ALLOWED');
    assertMember(chat, targetId);
  });
}

/** Any member can leave. The last member leaving leaves an empty group in place. */
export async function leaveGroupChat(chatId: string, userId: string): Promise<void> {
  await removeMember(chatId, userId, userId, 'member_left', (chat) => assertMember(chat, userId));
}

/**
 * Admin-only promote/demote. Demoting the only admin is rejected (`CHAT_LAST_ADMIN`);
 * promoting an admin or demoting a non-admin is a no-op.
 */
export async function setGroupAdmin(
  chatId: string,
  actorId: string,
  targetId: string,
  isAdmin: boolean
): Promise<void> {
  const chatRef = doc(db, CHATS_COLLECTION, chatId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chatRef);
    if (!snap.exists()) throw new ChatError('CHAT_NOT_FOUND');
    const chat = mapDocToChat(snap.id, snap.data());
    assertGroup(chat);
    assertAdmin(chat, actorId);
    assertMember(chat, targetId);

    if (chat.adminIds.includes(targetId) === isAdmin) return;

    let adminIds: string[];
    if (isAdmin) {
      adminIds = [...chat.adminIds, targetId];
    } else {
      adminIds = chat.adminIds.filter((userId) => userId !== targetId);
      if (!adminIds.some((userId) => chat.userIds.includes(userId))) {
        throw new ChatError('CHAT_LAST_ADMIN');
      }
    }

    transaction.update(chatRef, 'admin_ids', adminIds, 'updated_at', serverTimestamp());
    transaction.set(
      doc(collection(chatRef, MESSAGES_SUBCOLLECTION)),
      systemMessageData(chatRef.id, isAdmin ? 'admin_promoted' : 'admin_demoted', actorId, [targetId])
    );
  });
}
