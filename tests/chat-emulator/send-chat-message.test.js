import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

const T0 = new Date('2024-01-02T03:04:05.000Z');
const T1 = new Date('2024-02-03T04:05:06.000Z');
const T2 = new Date('2024-03-04T05:06:07.000Z');

const ALICE = { fullName: 'Alice A', avatarUrl: null };
const BOB = { fullName: 'Bob B', avatarUrl: 'http://x/bob.png' };

async function service() {
  const s = await loadChatService();
  expect(typeof s.sendChatMessage).toBe('function');
  return s;
}

async function send(dto) {
  const s = await service();
  return s.sendChatMessage(dto);
}

async function raw(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.exists() ? snap.data() : null;
}

async function messages(chatId) {
  const snap = await getDocs(collection(db, 'chats', chatId, 'chat_messages'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const seededLastMessage = {
  message_id: 'm0',
  author_id: 'alice',
  message: 'old',
  created_at: Timestamp.fromDate(T2),
  is_deleted: false,
};

async function seedDirect(unread = { alice: 3, bob: 3 }, id = 'alice_bob') {
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
    last_message: seededLastMessage,
    last_message_at: Timestamp.fromDate(T2),
    unread_counts: unread,
    created_at: Timestamp.fromDate(T0),
    updated_at: Timestamp.fromDate(T1),
  });
}

async function seedGroup(unread = { alice: 1, bob: 2, carol: 3, dave: 4 }, id = 'group1') {
  await setDoc(doc(db, 'chats', id), {
    type: 'group',
    user_ids: ['alice', 'bob', 'carol', 'dave'],
    participants: {
      alice: { full_name: 'Alice A', avatar_url: null },
      bob: { full_name: 'Bob B', avatar_url: null },
      carol: { full_name: 'Carol C', avatar_url: null },
      dave: { full_name: 'Dave D', avatar_url: null },
    },
    name: 'Study group',
    avatar_url: 'http://x/group.png',
    created_by: 'alice',
    admin_ids: ['alice'],
    last_message: seededLastMessage,
    last_message_at: Timestamp.fromDate(T2),
    unread_counts: unread,
    created_at: Timestamp.fromDate(T0),
    updated_at: Timestamp.fromDate(T1),
  });
}

function dto(overrides = {}) {
  return { chatId: 'alice_bob', authorId: 'alice', authorSnapshot: ALICE, message: 'hello', ...overrides };
}

async function expectRejectedWithNoWrite(chatId, code, input) {
  await service();
  const before = await raw(chatId);
  let error;
  try {
    await send(input);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  expect(await messages(chatId)).toHaveLength(0);
  const after = await raw(chatId);
  if (before === null) {
    expect(after).toBeNull();
    return;
  }
  expect(after.last_message).toEqual(before.last_message);
  expect(after.last_message_at.isEqual(before.last_message_at)).toBe(true);
  expect(after.unread_counts).toEqual(before.unread_counts);
  expect(after.updated_at.isEqual(before.updated_at)).toBe(true);
}

describe('sendChatMessage validation (spec §3.2 error codes, AC#17)', () => {
  test('empty body rejects with CHAT_MESSAGE_EMPTY and writes nothing', async () => {
    await seedDirect();
    await expectRejectedWithNoWrite('alice_bob', 'CHAT_MESSAGE_EMPTY', dto({ message: '' }));
  });

  test('whitespace-only body rejects with CHAT_MESSAGE_EMPTY and writes nothing', async () => {
    await seedDirect();
    await expectRejectedWithNoWrite('alice_bob', 'CHAT_MESSAGE_EMPTY', dto({ message: ' \n\t  ' }));
  });

  test('2001 chars rejects with CHAT_MESSAGE_TOO_LONG and writes nothing', async () => {
    await seedDirect();
    await expectRejectedWithNoWrite('alice_bob', 'CHAT_MESSAGE_TOO_LONG', dto({ message: 'a'.repeat(2001) }));
  });

  test('2001 chars with surrounding whitespace still rejects with CHAT_MESSAGE_TOO_LONG', async () => {
    await seedDirect();
    await expectRejectedWithNoWrite(
      'alice_bob',
      'CHAT_MESSAGE_TOO_LONG',
      dto({ message: `  ${'é'.repeat(2001)}\n` }),
    );
  });

  test('exactly 2000 chars is accepted and stored in full', async () => {
    await seedDirect();
    const body = 'b'.repeat(2000);
    const result = await send(dto({ message: body }));
    expect(result.message).toBe(body);
    const docs = await messages('alice_bob');
    expect(docs).toHaveLength(1);
    expect(docs[0].message).toBe(body);
  });

  test('2000 chars plus surrounding whitespace is accepted (trimmed first)', async () => {
    await seedDirect();
    const body = 'c'.repeat(2000);
    const result = await send(dto({ message: `   ${body}\n\n ` }));
    expect(result.message).toBe(body);
    expect((await messages('alice_bob'))[0].message).toBe(body);
  });
});

describe('sendChatMessage chat/membership checks (spec §3.2 error codes)', () => {
  test('missing chat rejects with CHAT_NOT_FOUND and creates nothing', async () => {
    await expectRejectedWithNoWrite('ghost_chat', 'CHAT_NOT_FOUND', dto({ chatId: 'ghost_chat' }));
  });

  test('author not in user_ids rejects with CHAT_NOT_PARTICIPANT and writes nothing (direct)', async () => {
    await seedDirect();
    await expectRejectedWithNoWrite(
      'alice_bob',
      'CHAT_NOT_PARTICIPANT',
      dto({ authorId: 'mallory', authorSnapshot: { fullName: 'Mallory', avatarUrl: null } }),
    );
  });

  test('author not in user_ids rejects with CHAT_NOT_PARTICIPANT and writes nothing (group)', async () => {
    await seedGroup();
    await expectRejectedWithNoWrite(
      'group1',
      'CHAT_NOT_PARTICIPANT',
      dto({ chatId: 'group1', authorId: 'mallory', authorSnapshot: { fullName: 'Mallory', avatarUrl: null } }),
    );
  });
});

describe('sendChatMessage success (spec §3.1/§3.2, AC#11)', () => {
  test('resolves the created ChatMessage with trimmed body and camelCase fields', async () => {
    await seedDirect();
    const result = await send(dto({ message: '  hello world \n' }));
    const docs = await messages('alice_bob');
    expect(docs).toHaveLength(1);
    expect(result.id).toBe(docs[0].id);
    expect(result.chatId).toBe('alice_bob');
    expect(result.type).toBe('text');
    expect(result.authorId).toBe('alice');
    expect(result.authorSnapshot).toEqual(ALICE);
    expect(result.message).toBe('hello world');
    expect(result.systemEvent).toBeNull();
    expect(result.isDeleted).toBe(false);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  test('writes the message doc in snake_case wire format with server timestamps', async () => {
    await seedDirect();
    await send(dto({ authorId: 'bob', authorSnapshot: BOB, message: '  hi there ' }));
    const [m] = await messages('alice_bob');
    expect(m.chat_id).toBe('alice_bob');
    expect(m.type).toBe('text');
    expect(m.author_id).toBe('bob');
    expect(m.author_snapshot).toEqual({ full_name: 'Bob B', avatar_url: 'http://x/bob.png' });
    expect(m.message).toBe('hi there');
    expect(m.system_event).toBeNull();
    expect(m.is_deleted).toBe(false);
    expect(m.created_at).toBeInstanceOf(Timestamp);
    expect(m.updated_at).toBeInstanceOf(Timestamp);
    expect(Math.abs(m.created_at.toMillis() - Date.now())).toBeLessThan(60_000);
  });

  test('stores the author snapshot passed in, not the chat participants entry', async () => {
    await seedDirect();
    const snapshot = { fullName: 'Alice Renamed', avatarUrl: 'http://x/new.png' };
    const result = await send(dto({ authorSnapshot: snapshot }));
    expect(result.authorSnapshot).toEqual(snapshot);
    const [m] = await messages('alice_bob');
    expect(m.author_snapshot).toEqual({ full_name: 'Alice Renamed', avatar_url: 'http://x/new.png' });
  });

  test('updates last_message, last_message_at and updated_at in the same commit', async () => {
    await seedDirect();
    const result = await send(dto({ message: '  fresh news ' }));
    const [m] = await messages('alice_bob');
    const chat = await raw('alice_bob');
    expect(chat.last_message.message_id).toBe(m.id);
    expect(chat.last_message.message_id).toBe(result.id);
    expect(chat.last_message.author_id).toBe('alice');
    expect(chat.last_message.message).toBe('fresh news');
    expect(chat.last_message.is_deleted).toBe(false);
    expect(chat.last_message.created_at).toBeInstanceOf(Timestamp);
    expect(chat.last_message.created_at.isEqual(m.created_at)).toBe(true);
    expect(chat.last_message_at.isEqual(m.created_at)).toBe(true);
    expect(chat.last_message_at.toMillis()).toBeGreaterThan(T2.getTime());
    expect(chat.updated_at.toMillis()).toBeGreaterThan(T1.getTime());
    expect(Math.abs(chat.updated_at.toMillis() - Date.now())).toBeLessThan(60_000);
  });

  test('increments the other member counter and leaves the author counter alone (direct)', async () => {
    await seedDirect({ alice: 3, bob: 3 });
    await send(dto({ authorId: 'alice' }));
    expect((await raw('alice_bob')).unread_counts).toEqual({ alice: 3, bob: 4 });
  });

  test('a member without a counter entry gets 1', async () => {
    await seedDirect({ alice: 2 });
    await send(dto({ authorId: 'alice' }));
    expect((await raw('alice_bob')).unread_counts).toEqual({ alice: 2, bob: 1 });
  });

  test('group of 4: every member except the author gets +1', async () => {
    await seedGroup({ alice: 1, bob: 2, carol: 3, dave: 4 });
    await send(dto({ chatId: 'group1', authorId: 'bob', authorSnapshot: BOB }));
    expect((await raw('group1')).unread_counts).toEqual({ alice: 2, bob: 2, carol: 4, dave: 5 });
  });

  test('long message keeps full text but preview is the first 200 chars', async () => {
    await seedDirect();
    const body = 'x'.repeat(150) + 'y'.repeat(150);
    const result = await send(dto({ message: body }));
    expect(result.message).toBe(body);
    expect((await messages('alice_bob'))[0].message).toBe(body);
    const chat = await raw('alice_bob');
    expect(chat.last_message.message).toBe(body.slice(0, 200));
    expect(chat.last_message.message).toHaveLength(200);
  });

  test('preview of exactly 200 or fewer chars is the whole trimmed body', async () => {
    await seedDirect();
    await send(dto({ message: ' short one ' }));
    expect((await raw('alice_bob')).last_message.message).toBe('short one');
  });

  test('does not touch other chat fields (direct)', async () => {
    await seedDirect();
    const before = await raw('alice_bob');
    await send(dto());
    const after = await raw('alice_bob');
    for (const key of ['type', 'user_ids', 'participants', 'name', 'avatar_url', 'created_by', 'admin_ids']) {
      expect(after[key]).toEqual(before[key]);
    }
    expect(after.created_at.isEqual(before.created_at)).toBe(true);
  });

  test('does not touch other chat fields (group)', async () => {
    await seedGroup();
    const before = await raw('group1');
    await send(dto({ chatId: 'group1' }));
    const after = await raw('group1');
    for (const key of ['type', 'user_ids', 'participants', 'name', 'avatar_url', 'created_by', 'admin_ids']) {
      expect(after[key]).toEqual(before[key]);
    }
    expect(after.created_at.isEqual(before.created_at)).toBe(true);
  });

  test('does not touch another chat in the database', async () => {
    await seedDirect({ alice: 3, bob: 3 }, 'alice_bob');
    await seedGroup({ alice: 1, bob: 2, carol: 3, dave: 4 }, 'group1');
    const other = await raw('group1');
    await send(dto({ chatId: 'alice_bob' }));
    const after = await raw('group1');
    expect(after).toEqual(other);
    expect(await messages('group1')).toHaveLength(0);
  });
});

describe('sendChatMessage sequential and concurrent sends (AC#11, DDD §4.8)', () => {
  test('two sequential sends accumulate counters and last_message is the latest', async () => {
    await seedDirect({ alice: 0, bob: 3 });
    await send(dto({ message: 'first' }));
    const second = await send(dto({ message: 'second' }));
    const chat = await raw('alice_bob');
    expect(chat.unread_counts).toEqual({ alice: 0, bob: 5 });
    expect(chat.last_message.message).toBe('second');
    expect(chat.last_message.message_id).toBe(second.id);
    expect(await messages('alice_bob')).toHaveLength(2);
  });

  test('5 concurrent sends from the same author add exactly 5 to the recipient', async () => {
    await seedDirect({ alice: 0, bob: 0 });
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => send(dto({ message: `msg ${n}` }))),
    );
    const docs = await messages('alice_bob');
    expect(docs).toHaveLength(5);
    expect(new Set(results.map((r) => r.id)).size).toBe(5);
    const chat = await raw('alice_bob');
    expect(chat.unread_counts).toEqual({ alice: 0, bob: 5 });
    expect(docs.map((d) => d.id)).toContain(chat.last_message.message_id);
  });

  test('two authors sending concurrently each increment the other counter by the other count', async () => {
    await seedDirect({ alice: 1, bob: 10 });
    await Promise.all([
      send(dto({ authorId: 'alice', authorSnapshot: ALICE, message: 'a1' })),
      send(dto({ authorId: 'alice', authorSnapshot: ALICE, message: 'a2' })),
      send(dto({ authorId: 'alice', authorSnapshot: ALICE, message: 'a3' })),
      send(dto({ authorId: 'bob', authorSnapshot: BOB, message: 'b1' })),
      send(dto({ authorId: 'bob', authorSnapshot: BOB, message: 'b2' })),
    ]);
    const chat = await raw('alice_bob');
    expect(chat.unread_counts).toEqual({ alice: 3, bob: 13 });
    expect(await messages('alice_bob')).toHaveLength(5);
  });
});
