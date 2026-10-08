import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

async function getChat(chatId) {
  const service = await loadChatService();
  return service.getChat(chatId);
}

async function chatCount() {
  return (await getDocs(collection(db, 'chats'))).size;
}

const T0 = new Date('2024-01-02T03:04:05.000Z');
const T1 = new Date('2024-02-03T04:05:06.000Z');
const T2 = new Date('2024-03-04T05:06:07.000Z');

async function seedDirect(id = 'alice_bob') {
  await setDoc(doc(db, 'chats', id), {
    type: 'direct',
    user_ids: ['alice', 'bob'],
    participants: {
      alice: { full_name: 'Alice A', avatar_url: null },
      bob: { full_name: 'Bob B', avatar_url: 'http://x/bob.png' },
    },
    name: null,
    avatar_url: null,
    created_by: null,
    admin_ids: [],
    last_message: null,
    last_message_at: Timestamp.fromDate(T0),
    unread_counts: { alice: 0, bob: 0 },
    created_at: Timestamp.fromDate(T0),
    updated_at: Timestamp.fromDate(T1),
  });
}

async function seedGroup(id = 'group1') {
  await setDoc(doc(db, 'chats', id), {
    type: 'group',
    user_ids: ['carol', 'alice', 'bob'],
    participants: {
      carol: { full_name: 'Carol C', avatar_url: 'http://x/carol.png' },
      alice: { full_name: 'Alice A', avatar_url: null },
      bob: { full_name: 'Bob B', avatar_url: null },
    },
    name: 'Study group',
    avatar_url: 'http://x/group.png',
    created_by: 'carol',
    admin_ids: ['carol', 'alice'],
    last_message: null,
    last_message_at: serverTimestamp(),
    unread_counts: { carol: 0, alice: 0, bob: 0 },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

describe('getChat', () => {
  // Spec §3.2 Common row: "getChat: Point read; null if missing"
  test('resolves null (does not throw) when the document does not exist', async () => {
    const result = await getChat('does_not_exist');
    expect(result).toBeNull();
  });

  // Spec §3.2: null if missing, no side effects
  test('missing chat does not create any document', async () => {
    await getChat('ghost_chat');
    expect(await chatCount()).toBe(0);
  });

  // Spec §3.1 Chat shape for a direct document
  test('maps a direct chat document to the camelCase Chat with Date instances', async () => {
    await seedDirect();
    const chat = await getChat('alice_bob');
    expect(chat).not.toBeNull();
    expect(chat.id).toBe('alice_bob');
    expect(chat.type).toBe('direct');
    expect(chat.userIds).toEqual(['alice', 'bob']);
    expect(chat.participants).toEqual({
      alice: { fullName: 'Alice A', avatarUrl: null },
      bob: { fullName: 'Bob B', avatarUrl: 'http://x/bob.png' },
    });
    expect(chat.name).toBeNull();
    expect(chat.avatarUrl).toBeNull();
    expect(chat.createdBy).toBeNull();
    expect(chat.adminIds).toEqual([]);
    expect(chat.lastMessage).toBeNull();
    expect(chat.unreadCounts).toEqual({ alice: 0, bob: 0 });
    expect(chat.lastMessageAt).toBeInstanceOf(Date);
    expect(chat.createdAt).toBeInstanceOf(Date);
    expect(chat.updatedAt).toBeInstanceOf(Date);
    expect(chat.lastMessageAt.getTime()).toBe(T0.getTime());
    expect(chat.createdAt.getTime()).toBe(T0.getTime());
    expect(chat.updatedAt.getTime()).toBe(T1.getTime());
  });

  // Spec §3.1 Chat shape for a group document (join order, admins, name, creator)
  test('maps a group chat document, preserving join order and group fields', async () => {
    await seedGroup();
    const chat = await getChat('group1');
    expect(chat).not.toBeNull();
    expect(chat.id).toBe('group1');
    expect(chat.type).toBe('group');
    expect(chat.userIds).toEqual(['carol', 'alice', 'bob']);
    expect(chat.participants).toEqual({
      carol: { fullName: 'Carol C', avatarUrl: 'http://x/carol.png' },
      alice: { fullName: 'Alice A', avatarUrl: null },
      bob: { fullName: 'Bob B', avatarUrl: null },
    });
    expect(chat.name).toBe('Study group');
    expect(chat.avatarUrl).toBe('http://x/group.png');
    expect(chat.createdBy).toBe('carol');
    expect(chat.adminIds).toEqual(['carol', 'alice']);
    expect(chat.lastMessage).toBeNull();
    expect(chat.unreadCounts).toEqual({ carol: 0, alice: 0, bob: 0 });
  });

  // Spec §3.1: server timestamps resolve to real Dates
  test('server timestamps are returned as real Date instances close to now', async () => {
    await seedGroup();
    const chat = await getChat('group1');
    expect(chat.createdAt).toBeInstanceOf(Date);
    expect(chat.updatedAt).toBeInstanceOf(Date);
    expect(chat.lastMessageAt).toBeInstanceOf(Date);
    expect(Math.abs(chat.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
  });

  // Spec §3.1 ChatLastMessage + unreadCounts
  test('reflects a populated last_message and unread_counts', async () => {
    await seedDirect();
    await setDoc(
      doc(db, 'chats', 'alice_bob'),
      {
        last_message: {
          message_id: 'm1',
          author_id: 'alice',
          message: 'hello bob',
          created_at: Timestamp.fromDate(T2),
          is_deleted: false,
        },
        last_message_at: Timestamp.fromDate(T2),
        unread_counts: { alice: 0, bob: 3 },
      },
      { merge: true },
    );
    const chat = await getChat('alice_bob');
    expect(chat.lastMessage).not.toBeNull();
    expect(chat.lastMessage.messageId).toBe('m1');
    expect(chat.lastMessage.authorId).toBe('alice');
    expect(chat.lastMessage.message).toBe('hello bob');
    expect(chat.lastMessage.isDeleted).toBe(false);
    expect(chat.lastMessage.createdAt).toBeInstanceOf(Date);
    expect(chat.lastMessage.createdAt.getTime()).toBe(T2.getTime());
    expect(chat.lastMessageAt.getTime()).toBe(T2.getTime());
    expect(chat.unreadCounts).toEqual({ alice: 0, bob: 3 });
  });

  // Spec §3.1: isDeleted preview flag
  test('maps a soft-deleted last_message', async () => {
    await seedDirect();
    await setDoc(
      doc(db, 'chats', 'alice_bob'),
      {
        last_message: {
          message_id: 'm2',
          author_id: 'bob',
          message: '',
          created_at: Timestamp.fromDate(T2),
          is_deleted: true,
        },
      },
      { merge: true },
    );
    const chat = await getChat('alice_bob');
    expect(chat.lastMessage.messageId).toBe('m2');
    expect(chat.lastMessage.isDeleted).toBe(true);
  });

  // Spec §3.2: point read of the requested id only
  test('returns only the requested chat when several exist and creates nothing', async () => {
    await seedDirect('alice_bob');
    await seedGroup('group1');
    const chat = await getChat('group1');
    expect(chat.id).toBe('group1');
    expect(chat.type).toBe('group');
    expect(await getChat('alice_bob')).toMatchObject({ id: 'alice_bob', type: 'direct' });
    expect(await chatCount()).toBe(2);
  });

  // Read is pure: stored document untouched
  test('does not modify the stored document', async () => {
    await seedDirect();
    const before = (await getDocs(collection(db, 'chats'))).docs[0].data();
    await getChat('alice_bob');
    const after = (await getDocs(collection(db, 'chats'))).docs[0].data();
    expect(after).toEqual(before);
    expect(after.updated_at.isEqual(before.updated_at)).toBe(true);
  });
});
