import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { doc, getDoc, getDocs, collection, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService, setCurrentUser } from '../chat/emulator-env.js';

beforeEach(clearDatabase);
afterEach(() => setCurrentUser(null));

const T0 = new Date('2024-01-02T03:04:05.000Z');
const T1 = new Date('2024-02-03T04:05:06.000Z');
const T2 = new Date('2024-03-04T05:06:07.000Z');
const T3 = new Date('2024-03-05T05:06:07.000Z');

let counter = 0;
const uid = (p) => `${p}_${Date.now()}_${counter++}`;

async function service() {
  const s = await loadChatService();
  expect(typeof s.softDeleteChatMessage).toBe('function');
  return s;
}

async function rawDoc(...path) {
  const snap = await getDoc(doc(db, ...path));
  return snap.exists() ? snap.data() : null;
}
const rawChat = (id) => rawDoc('chats', id);
const rawMsg = (id, mid) => rawDoc('chats', id, 'chat_messages', mid);

function lastMessage(messageId, overrides = {}) {
  return {
    message_id: messageId,
    author_id: 'alice',
    message: 'original',
    created_at: Timestamp.fromDate(T2),
    is_deleted: false,
    ...overrides,
  };
}

async function seedChat(id, { type = 'direct', lastMessageId = 'm1', last } = {}) {
  const group = type === 'group';
  await setDoc(doc(db, 'chats', id), {
    type,
    user_ids: group ? ['alice', 'bob', 'carol'] : ['alice', 'bob'],
    participants: {
      alice: { full_name: 'Alice A', avatar_url: null },
      bob: { full_name: 'Bob B', avatar_url: null },
      ...(group ? { carol: { full_name: 'Carol C', avatar_url: null } } : {}),
    },
    name: group ? 'Study group' : null,
    avatar_url: null,
    created_by: group ? 'alice' : null,
    admin_ids: group ? ['alice'] : [],
    last_message: last ?? lastMessage(lastMessageId),
    last_message_at: Timestamp.fromDate(T2),
    unread_counts: group ? { alice: 0, bob: 2, carol: 5 } : { alice: 0, bob: 3 },
    created_at: Timestamp.fromDate(T0),
    updated_at: Timestamp.fromDate(T1),
  });
}

async function seedMsg(chatId, mid, overrides = {}) {
  await setDoc(doc(db, 'chats', chatId, 'chat_messages', mid), {
    chat_id: chatId,
    type: 'text',
    author_id: 'alice',
    author_snapshot: { full_name: 'Alice A', avatar_url: null },
    message: 'original',
    system_event: null,
    is_deleted: false,
    created_at: Timestamp.fromDate(T2),
    updated_at: Timestamp.fromDate(T3),
    ...overrides,
  });
}

async function seed(opts = {}, msgOverrides = {}) {
  const chatId = uid('chat');
  await seedChat(chatId, opts);
  await seedMsg(chatId, 'm1', msgOverrides);
  return chatId;
}

async function attempt(chatId, mid) {
  const s = await service();
  try {
    await s.softDeleteChatMessage(chatId, mid);
  } catch (e) {
    return e;
  }
  return undefined;
}

async function expectRejected(chatId, mid, code) {
  const chatBefore = await rawChat(chatId);
  const msgBefore = await rawMsg(chatId, mid);
  const error = await attempt(chatId, mid);
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  expect(await rawChat(chatId)).toEqual(chatBefore);
  expect(await rawMsg(chatId, mid)).toEqual(msgBefore);
}

describe('softDeleteChatMessage not found (spec §3.2)', () => {
  test('missing chat -> CHAT_NOT_FOUND and nothing is created', async () => {
    setCurrentUser('alice');
    const id = uid('nochat');
    const error = await attempt(id, 'm1');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CHAT_NOT_FOUND');
    expect(await rawChat(id)).toBeNull();
    expect(await rawMsg(id, 'm1')).toBeNull();
  });

  test('missing message -> CHAT_NOT_FOUND, chat unchanged, message not created', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const chatBefore = await rawChat(id);
    const error = await attempt(id, 'ghost');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CHAT_NOT_FOUND');
    expect(await rawMsg(id, 'ghost')).toBeNull();
    expect(await rawChat(id)).toEqual(chatBefore);
  });

  test('not-found precedes author check (no user, missing message)', async () => {
    setCurrentUser(null);
    const id = await seed();
    await expectRejected(id, 'ghost', 'CHAT_NOT_FOUND');
  });

  test('not-found precedes author check (non-author, missing chat)', async () => {
    setCurrentUser('bob');
    const error = await attempt(uid('nochat'), 'm1');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CHAT_NOT_FOUND');
  });
});

describe('softDeleteChatMessage author-only (AC#16)', () => {
  test('another user cannot delete -> CHAT_NOT_AUTHOR, nothing changed', async () => {
    setCurrentUser('bob');
    const id = await seed();
    await expectRejected(id, 'm1', 'CHAT_NOT_AUTHOR');
  });

  test('no current user -> CHAT_NOT_AUTHOR, nothing changed', async () => {
    setCurrentUser(null);
    const id = await seed();
    await expectRejected(id, 'm1', 'CHAT_NOT_AUTHOR');
  });

  test('system message cannot be deleted, even by its author_id -> CHAT_NOT_AUTHOR', async () => {
    setCurrentUser('alice');
    const id = await seed(
      {},
      { type: 'system', author_id: 'alice', system_event: { kind: 'member_added', user_id: 'bob' } },
    );
    await expectRejected(id, 'm1', 'CHAT_NOT_AUTHOR');
  });

  test('non-author in a group chat -> CHAT_NOT_AUTHOR, nothing changed', async () => {
    setCurrentUser('carol');
    const id = await seed({ type: 'group' });
    await expectRejected(id, 'm1', 'CHAT_NOT_AUTHOR');
  });

  test('non-author on an already-deleted message still gets CHAT_NOT_AUTHOR', async () => {
    setCurrentUser('bob');
    const id = await seed({}, { is_deleted: true });
    await expectRejected(id, 'm1', 'CHAT_NOT_AUTHOR');
  });
});

describe('softDeleteChatMessage success (spec §3.2, AC#16)', () => {
  test('author delete soft-deletes: doc kept, is_deleted true, updated_at bumped, other fields unchanged', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    const before = await rawMsg(id, 'm1');
    const result = await s.softDeleteChatMessage(id, 'm1');
    expect(result).toBeUndefined();
    const after = await rawMsg(id, 'm1');
    expect(after).not.toBeNull();
    expect(after.is_deleted).toBe(true);
    expect(after.updated_at.toMillis()).toBeGreaterThan(before.updated_at.toMillis());
    expect(after.updated_at.toMillis()).toBeGreaterThan(T3.getTime());
    const { is_deleted: _d, updated_at: _u, ...rest } = after;
    const { is_deleted: _bd, updated_at: _bu, ...restBefore } = before;
    expect(rest).toEqual(restBefore);
    expect(after.message).toBe('original');
    expect(after.chat_id).toBe(id);
    expect(after.type).toBe('text');
    expect(after.author_id).toBe('alice');
    expect(after.system_event).toBeNull();
    expect(after.created_at.isEqual(before.created_at)).toBe(true);
  });

  test('never hard-deletes: message still listed in the collection', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    await s.softDeleteChatMessage(id, 'm1');
    const snap = await getDocs(collection(db, 'chats', id, 'chat_messages'));
    expect(snap.docs.map((d) => d.id)).toEqual(['m1']);
    expect(snap.docs[0].data().is_deleted).toBe(true);
  });

  test('works in group chats', async () => {
    setCurrentUser('alice');
    const id = await seed({ type: 'group' });
    const s = await service();
    await s.softDeleteChatMessage(id, 'm1');
    expect((await rawMsg(id, 'm1')).is_deleted).toBe(true);
    expect((await rawChat(id)).last_message.is_deleted).toBe(true);
  });

  test('other messages in the chat and in other chats are untouched', async () => {
    setCurrentUser('alice');
    const id = await seed();
    await seedMsg(id, 'm0', { message: 'older', created_at: Timestamp.fromDate(T1) });
    const otherId = await seed();
    const s = await service();
    const m0Before = await rawMsg(id, 'm0');
    const otherMsgBefore = await rawMsg(otherId, 'm1');
    const otherChatBefore = await rawChat(otherId);
    await s.softDeleteChatMessage(id, 'm1');
    expect(await rawMsg(id, 'm0')).toEqual(m0Before);
    expect(await rawMsg(otherId, 'm1')).toEqual(otherMsgBefore);
    expect(await rawChat(otherId)).toEqual(otherChatBefore);
  });

  test('deleting two different messages sequentially works', async () => {
    setCurrentUser('alice');
    const id = await seed();
    await seedMsg(id, 'm0', { message: 'older', created_at: Timestamp.fromDate(T1) });
    const s = await service();
    await s.softDeleteChatMessage(id, 'm0');
    await s.softDeleteChatMessage(id, 'm1');
    expect((await rawMsg(id, 'm0')).is_deleted).toBe(true);
    expect((await rawMsg(id, 'm1')).is_deleted).toBe(true);
    expect((await rawChat(id)).last_message.is_deleted).toBe(true);
  });
});

describe('softDeleteChatMessage idempotency', () => {
  test('author deleting an already-deleted message resolves and writes nothing', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    await s.softDeleteChatMessage(id, 'm1');
    const msgBefore = await rawMsg(id, 'm1');
    const chatBefore = await rawChat(id);
    const result = await s.softDeleteChatMessage(id, 'm1');
    expect(result).toBeUndefined();
    expect(await rawMsg(id, 'm1')).toEqual(msgBefore);
    expect(await rawChat(id)).toEqual(chatBefore);
  });

  test('seeded already-deleted message: resolves, message and chat identical to seed', async () => {
    setCurrentUser('alice');
    const id = await seed({}, { is_deleted: true });
    const s = await service();
    const msgBefore = await rawMsg(id, 'm1');
    const chatBefore = await rawChat(id);
    await s.softDeleteChatMessage(id, 'm1');
    expect(await rawMsg(id, 'm1')).toEqual(msgBefore);
    expect(await rawChat(id)).toEqual(chatBefore);
  });
});

describe('softDeleteChatMessage last_message handling (spec §3.2, AC#16)', () => {
  for (const type of ['direct', 'group']) {
    test(`latest message in ${type} chat: preview marked deleted and text cleared, ordering and counters untouched`, async () => {
      setCurrentUser('alice');
      const id = await seed({ type });
      const s = await service();
      const before = await rawChat(id);
      await s.softDeleteChatMessage(id, 'm1');
      const after = await rawChat(id);
      expect(after.last_message.is_deleted).toBe(true);
      expect(after.last_message.message).toBe('');
      expect(after.last_message.message_id).toBe('m1');
      expect(after.last_message.author_id).toBe(before.last_message.author_id);
      expect(after.last_message.created_at.isEqual(before.last_message.created_at)).toBe(true);
      const { is_deleted: _a, message: _am, ...lastAfter } = after.last_message;
      const { is_deleted: _b, message: _bm, ...lastBefore } = before.last_message;
      expect(lastAfter).toEqual(lastBefore);
      expect(after.updated_at.toMillis()).toBeGreaterThan(before.updated_at.toMillis());
      expect(after.updated_at.toMillis()).toBeGreaterThan(T3.getTime());
      expect(after.last_message_at.isEqual(before.last_message_at)).toBe(true);
      expect(after.unread_counts).toEqual(before.unread_counts);
      const { last_message: _l, updated_at: _u, ...restAfter } = after;
      const { last_message: _lb, updated_at: _ub, ...restBefore } = before;
      expect(restAfter).toEqual(restBefore);
    });
  }

  test('not the latest message: chat document completely unchanged (including updated_at)', async () => {
    setCurrentUser('alice');
    const id = await seed({ lastMessageId: 'm2', last: lastMessage('m2', { author_id: 'bob', message: 'newer' }) });
    const s = await service();
    const chatBefore = await rawChat(id);
    await s.softDeleteChatMessage(id, 'm1');
    expect((await rawMsg(id, 'm1')).is_deleted).toBe(true);
    expect(await rawChat(id)).toEqual(chatBefore);
  });

  test('after deleting the latest message, raw reads still show it with is_deleted true', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    await s.softDeleteChatMessage(id, 'm1');
    const snap = await getDoc(doc(db, 'chats', id, 'chat_messages', 'm1'));
    expect(snap.exists()).toBe(true);
    expect(snap.data().is_deleted).toBe(true);
  });
});
