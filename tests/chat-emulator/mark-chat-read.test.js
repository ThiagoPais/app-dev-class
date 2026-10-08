import { beforeEach, describe, expect, test } from 'bun:test';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

async function markChatAsRead(chatId, userId) {
  const service = await loadChatService();
  return service.markChatAsRead(chatId, userId);
}

async function raw(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.exists() ? snap.data() : null;
}

const T0 = new Date('2024-01-02T03:04:05.000Z');
const T1 = new Date('2024-02-03T04:05:06.000Z');
const T2 = new Date('2024-03-04T05:06:07.000Z');

const lastMessage = {
  message_id: 'm1',
  author_id: 'alice',
  message: 'hello',
  created_at: Timestamp.fromDate(T2),
  is_deleted: false,
};

async function seedDirect(unread = { alice: 3, bob: 5 }, id = 'alice_bob') {
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
    last_message: lastMessage,
    last_message_at: Timestamp.fromDate(T2),
    unread_counts: unread,
    created_at: Timestamp.fromDate(T0),
    updated_at: Timestamp.fromDate(T1),
  });
}

async function seedGroup(unread = { alice: 3, bob: 5, carol: 2 }, id = 'group1') {
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
    last_message: lastMessage,
    last_message_at: Timestamp.fromDate(T2),
    unread_counts: unread,
    created_at: Timestamp.fromDate(T0),
    updated_at: Timestamp.fromDate(T1),
  });
}

function withoutCountsAndUpdated(data) {
  const { unread_counts, updated_at, ...rest } = data;
  return rest;
}

describe('markChatAsRead', () => {
  // Spec §3.2 Common row: sets unread_counts.{userId} = 0
  test('zeroes the caller counter in a direct chat and resolves undefined', async () => {
    await seedDirect();
    const result = await markChatAsRead('alice_bob', 'bob');
    expect(result).toBeUndefined();
    const data = await raw('alice_bob');
    expect(data.unread_counts.bob).toBe(0);
  });

  // Spec §3.2 + AC#12: only the caller's counter is zeroed (group)
  test('zeroes only the caller counter in a group chat', async () => {
    await seedGroup();
    await markChatAsRead('group1', 'bob');
    const data = await raw('group1');
    expect(data.unread_counts).toEqual({ alice: 3, bob: 0, carol: 2 });
  });

  // AC#12 (direct): the other member keeps their count
  test('leaves the other member counter untouched in a direct chat', async () => {
    await seedDirect({ alice: 3, bob: 5 });
    await markChatAsRead('alice_bob', 'alice');
    const data = await raw('alice_bob');
    expect(data.unread_counts).toEqual({ alice: 0, bob: 5 });
  });

  // Spec §3.2: (+ updated_at) server timestamp bump
  test('bumps updated_at to a server timestamp later than the seeded value', async () => {
    await seedGroup();
    await markChatAsRead('group1', 'alice');
    const data = await raw('group1');
    expect(data.updated_at).toBeInstanceOf(Timestamp);
    expect(data.updated_at.toMillis()).toBeGreaterThan(T1.getTime());
    expect(Math.abs(data.updated_at.toMillis() - Date.now())).toBeLessThan(60_000);
  });

  // Spec §3.2 / plan §4: no other field changes; last_message_at stays (list order)
  test('does not change any other stored field, in particular last_message_at', async () => {
    await seedGroup();
    const before = await raw('group1');
    await markChatAsRead('group1', 'bob');
    const after = await raw('group1');
    expect(withoutCountsAndUpdated(after)).toEqual(withoutCountsAndUpdated(before));
    expect(after.last_message_at.isEqual(Timestamp.fromDate(T2))).toBe(true);
    expect(after.created_at.isEqual(Timestamp.fromDate(T0))).toBe(true);
    expect(after.type).toBe('group');
    expect(after.user_ids).toEqual(['carol', 'alice', 'bob']);
    expect(after.admin_ids).toEqual(['carol', 'alice']);
    expect(after.name).toBe('Study group');
  });

  test('does not change other fields of a direct chat', async () => {
    await seedDirect();
    const before = await raw('alice_bob');
    await markChatAsRead('alice_bob', 'alice');
    const after = await raw('alice_bob');
    expect(withoutCountsAndUpdated(after)).toEqual(withoutCountsAndUpdated(before));
    expect(after.last_message_at.isEqual(before.last_message_at)).toBe(true);
  });

  // Idempotency
  test('calling twice resolves and leaves counters as they are', async () => {
    await seedGroup();
    await markChatAsRead('group1', 'bob');
    await markChatAsRead('group1', 'bob');
    const data = await raw('group1');
    expect(data.unread_counts).toEqual({ alice: 3, bob: 0, carol: 2 });
  });

  test('resolves when the counter is already 0', async () => {
    await seedDirect({ alice: 0, bob: 4 });
    await markChatAsRead('alice_bob', 'alice');
    const data = await raw('alice_bob');
    expect(data.unread_counts).toEqual({ alice: 0, bob: 4 });
  });

  // Missing chat rejects
  test('rejects when the chat does not exist and creates no document', async () => {
    const service = await loadChatService();
    expect(typeof service.markChatAsRead).toBe('function');
    await expect(markChatAsRead('ghost_chat', 'alice')).rejects.toBeDefined();
    expect(await raw('ghost_chat')).toBeNull();
  });

  // Missing entry gets 0, others unchanged
  test('a userId with no unread_counts entry gets 0 and other counters are unchanged', async () => {
    await seedDirect({ alice: 3 });
    await markChatAsRead('alice_bob', 'bob');
    const data = await raw('alice_bob');
    expect(data.unread_counts).toEqual({ alice: 3, bob: 0 });
  });

  // Wire type: integer 0
  test('stores an integer 0 (not a string or null)', async () => {
    await seedDirect();
    await markChatAsRead('alice_bob', 'bob');
    const value = (await raw('alice_bob')).unread_counts.bob;
    expect(typeof value).toBe('number');
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBe(0);
  });

  // Only the targeted chat is affected
  test('does not touch other chats', async () => {
    await seedDirect({ alice: 3, bob: 5 }, 'alice_bob');
    await seedGroup({ alice: 3, bob: 5, carol: 2 }, 'group1');
    await markChatAsRead('group1', 'bob');
    expect((await raw('alice_bob')).unread_counts).toEqual({ alice: 3, bob: 5 });
  });
});
