import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

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
  expect(typeof s.updateChatMessage).toBe('function');
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

async function expectRejected(chatId, mid, text, code) {
  const s = await service();
  const chatBefore = await rawChat(chatId);
  const msgBefore = await rawMsg(chatId, mid);
  let error;
  try {
    await s.updateChatMessage(chatId, mid, text);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  expect(await rawChat(chatId)).toEqual(chatBefore);
  expect(await rawMsg(chatId, mid)).toEqual(msgBefore);
}

describe('updateChatMessage validation (spec §3.2, AC#17)', () => {
  test('empty body -> CHAT_MESSAGE_EMPTY, nothing changed', async () => {
    setCurrentUser('alice');
    const id = await seed();
    await expectRejected(id, 'm1', '', 'CHAT_MESSAGE_EMPTY');
  });

  test('whitespace-only body -> CHAT_MESSAGE_EMPTY, nothing changed', async () => {
    setCurrentUser('alice');
    const id = await seed();
    await expectRejected(id, 'm1', ' \n\t  ', 'CHAT_MESSAGE_EMPTY');
  });

  test('2001 chars after trim -> CHAT_MESSAGE_TOO_LONG, nothing changed', async () => {
    setCurrentUser('alice');
    const id = await seed();
    await expectRejected(id, 'm1', 'a'.repeat(2001), 'CHAT_MESSAGE_TOO_LONG');
  });

  test('validation runs before any read: missing chat with empty body -> CHAT_MESSAGE_EMPTY', async () => {
    setCurrentUser('alice');
    const s = await service();
    let error;
    try {
      await s.updateChatMessage(uid('nochat'), 'm1', '   ');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CHAT_MESSAGE_EMPTY');
  });

  test('validation runs before author check: non-author with too-long body -> CHAT_MESSAGE_TOO_LONG', async () => {
    setCurrentUser('bob');
    const id = await seed();
    await expectRejected(id, 'm1', 'a'.repeat(2001), 'CHAT_MESSAGE_TOO_LONG');
  });

  test('exactly 2000 chars is accepted', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    await s.updateChatMessage(id, 'm1', 'a'.repeat(2000));
    expect((await rawMsg(id, 'm1')).message).toBe('a'.repeat(2000));
  });

  test('2000 chars plus surrounding whitespace is accepted and trimmed', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    await s.updateChatMessage(id, 'm1', `  ${'a'.repeat(2000)}  \n`);
    expect((await rawMsg(id, 'm1')).message).toBe('a'.repeat(2000));
  });
});

describe('updateChatMessage not found (spec §3.2)', () => {
  test('missing chat -> CHAT_NOT_FOUND and nothing is created', async () => {
    setCurrentUser('alice');
    const s = await service();
    const id = uid('nochat');
    let error;
    try {
      await s.updateChatMessage(id, 'm1', 'new');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CHAT_NOT_FOUND');
    expect(await rawChat(id)).toBeNull();
    expect(await rawMsg(id, 'm1')).toBeNull();
  });

  test('missing message -> CHAT_NOT_FOUND, chat unchanged, message not created', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    const chatBefore = await rawChat(id);
    let error;
    try {
      await s.updateChatMessage(id, 'ghost', 'new');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('CHAT_NOT_FOUND');
    expect(await rawMsg(id, 'ghost')).toBeNull();
    expect(await rawChat(id)).toEqual(chatBefore);
  });

  test('soft-deleted message -> CHAT_NOT_FOUND, nothing changed', async () => {
    setCurrentUser('alice');
    const id = await seed({}, { is_deleted: true });
    await expectRejected(id, 'm1', 'new', 'CHAT_NOT_FOUND');
  });

  test('not-found check precedes author check (non-author, soft-deleted message)', async () => {
    setCurrentUser('bob');
    const id = await seed({}, { is_deleted: true });
    await expectRejected(id, 'm1', 'new', 'CHAT_NOT_FOUND');
  });

  test('not-found check precedes author check (no user, missing message)', async () => {
    setCurrentUser(null);
    const id = await seed();
    await expectRejected(id, 'ghost', 'new', 'CHAT_NOT_FOUND');
  });
});

describe('updateChatMessage author-only (AC#16)', () => {
  test('another user cannot edit -> CHAT_NOT_AUTHOR, nothing changed', async () => {
    setCurrentUser('bob');
    const id = await seed();
    await expectRejected(id, 'm1', 'hijacked', 'CHAT_NOT_AUTHOR');
  });

  test('no current user -> CHAT_NOT_AUTHOR, nothing changed', async () => {
    setCurrentUser(null);
    const id = await seed();
    await expectRejected(id, 'm1', 'anon', 'CHAT_NOT_AUTHOR');
  });

  test('system message cannot be edited, even by its author_id -> CHAT_NOT_AUTHOR', async () => {
    setCurrentUser('alice');
    const id = await seed(
      {},
      { type: 'system', author_id: 'alice', system_event: { kind: 'member_added', user_id: 'bob' } },
    );
    await expectRejected(id, 'm1', 'edited system', 'CHAT_NOT_AUTHOR');
  });

  test('non-author in a group chat -> CHAT_NOT_AUTHOR, nothing changed', async () => {
    setCurrentUser('carol');
    const id = await seed({ type: 'group' });
    await expectRejected(id, 'm1', 'hijacked', 'CHAT_NOT_AUTHOR');
  });
});

describe('updateChatMessage success (spec §3.2)', () => {
  test('author edit updates message (trimmed) and updated_at; other fields unchanged', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    const before = await rawMsg(id, 'm1');
    const result = await s.updateChatMessage(id, 'm1', '  edited text \n');
    expect(result).toBeUndefined();
    const after = await rawMsg(id, 'm1');
    expect(after.message).toBe('edited text');
    expect(after.updated_at.toMillis()).toBeGreaterThan(before.updated_at.toMillis());
    expect(after.updated_at.toMillis()).toBeGreaterThan(T3.getTime());
    const { message: _m, updated_at: _u, ...rest } = after;
    const { message: _bm, updated_at: _bu, ...restBefore } = before;
    expect(rest).toEqual(restBefore);
    expect(after.is_deleted).toBe(false);
    expect(after.type).toBe('text');
    expect(after.author_id).toBe('alice');
    expect(after.created_at.isEqual(before.created_at)).toBe(true);
  });

  test('editing to the same text is allowed and still bumps updated_at', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    const before = await rawMsg(id, 'm1');
    await s.updateChatMessage(id, 'm1', 'original');
    const after = await rawMsg(id, 'm1');
    expect(after.message).toBe('original');
    expect(after.updated_at.toMillis()).toBeGreaterThan(before.updated_at.toMillis());
  });

  test('body longer than 200 chars is stored in full on the message', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    const long = 'b'.repeat(500);
    await s.updateChatMessage(id, 'm1', long);
    expect((await rawMsg(id, 'm1')).message).toBe(long);
  });

  test('works in group chats', async () => {
    setCurrentUser('alice');
    const id = await seed({ type: 'group' });
    const s = await service();
    await s.updateChatMessage(id, 'm1', 'group edit');
    expect((await rawMsg(id, 'm1')).message).toBe('group edit');
    expect((await rawChat(id)).last_message.message).toBe('group edit');
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
    await s.updateChatMessage(id, 'm1', 'only this one');
    expect(await rawMsg(id, 'm0')).toEqual(m0Before);
    expect(await rawMsg(otherId, 'm1')).toEqual(otherMsgBefore);
    expect(await rawChat(otherId)).toEqual(otherChatBefore);
  });
});

describe('updateChatMessage last_message refresh (spec §3.2)', () => {
  for (const type of ['direct', 'group']) {
    test(`latest message in ${type} chat: preview refreshed, ordering and counters untouched`, async () => {
      setCurrentUser('alice');
      const id = await seed({ type });
      const s = await service();
      const before = await rawChat(id);
      await s.updateChatMessage(id, 'm1', '  fresh preview ');
      const after = await rawChat(id);
      expect(after.last_message.message).toBe('fresh preview');
      const { message: _a, ...lastAfter } = after.last_message;
      const { message: _b, ...lastBefore } = before.last_message;
      expect(lastAfter).toEqual(lastBefore);
      expect(after.last_message.message_id).toBe('m1');
      expect(after.updated_at.toMillis()).toBeGreaterThan(before.updated_at.toMillis());
      expect(after.updated_at.toMillis()).toBeGreaterThan(T3.getTime());
      expect(after.last_message_at.isEqual(before.last_message_at)).toBe(true);
      expect(after.unread_counts).toEqual(before.unread_counts);
      const { last_message: _l, updated_at: _u, ...restAfter } = after;
      const { last_message: _lb, updated_at: _ub, ...restBefore } = before;
      expect(restAfter).toEqual(restBefore);
    });
  }

  test('preview is the first 200 chars of the trimmed text; message keeps the full text', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    const long = 'c'.repeat(150) + 'd'.repeat(350);
    await s.updateChatMessage(id, 'm1', `  ${long}  `);
    expect((await rawChat(id)).last_message.message).toBe(long.slice(0, 200));
    expect((await rawMsg(id, 'm1')).message).toBe(long);
  });

  test('not the latest message: chat document completely unchanged (including updated_at)', async () => {
    setCurrentUser('alice');
    const id = await seed({ lastMessageId: 'm2', last: lastMessage('m2', { author_id: 'bob', message: 'newer' }) });
    const s = await service();
    const chatBefore = await rawChat(id);
    await s.updateChatMessage(id, 'm1', 'edited old one');
    expect((await rawMsg(id, 'm1')).message).toBe('edited old one');
    expect(await rawChat(id)).toEqual(chatBefore);
  });

  test('two sequential edits: last wins and the preview matches it', async () => {
    setCurrentUser('alice');
    const id = await seed();
    const s = await service();
    await s.updateChatMessage(id, 'm1', 'first edit');
    const mid = await rawMsg(id, 'm1');
    await s.updateChatMessage(id, 'm1', 'second edit');
    const msg = await rawMsg(id, 'm1');
    expect(msg.message).toBe('second edit');
    expect(msg.updated_at.toMillis()).toBeGreaterThanOrEqual(mid.updated_at.toMillis());
    expect((await rawChat(id)).last_message.message).toBe('second edit');
  });
});
