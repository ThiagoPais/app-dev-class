import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

let counter = 0;
const nextId = (p = 'chat') => `${p}-${Date.now()}-${++counter}`;

const SEED_MS = 1_700_000_000_000;
const ts = (offset = 0) => Timestamp.fromMillis(SEED_MS + offset);
const wire = (n) => ({ full_name: `User ${n}`, avatar_url: n % 2 ? `http://x/${n}.png` : null });

// Members: admin, mod (both admins), plain (5 unread), then extras. Counters of others are non-zero.
async function seedGroup(overrides = {}, extraUsers = []) {
  const id = overrides.id ?? nextId();
  const userIds = overrides.userIds ?? ['admin', 'mod', 'plain', ...extraUsers];
  const participants = {};
  const unread = {};
  userIds.forEach((u, i) => {
    participants[u] = wire(i + 10);
    unread[u] = i + 1;
  });
  const data = {
    type: 'group',
    user_ids: userIds,
    name: 'Study group',
    avatar_url: 'http://x/g.png',
    created_by: 'admin',
    admin_ids: ['admin', 'mod'],
    participants,
    unread_counts: unread,
    last_message: {
      text: 'hello',
      author_id: 'plain',
      type: 'text',
      created_at: ts(500),
    },
    last_message_at: ts(500),
    created_at: ts(0),
    updated_at: ts(1000),
    ...overrides.data,
  };
  await setDoc(doc(db, 'chats', id), data);
  return { id, data };
}

async function seedDirect() {
  const id = nextId('direct');
  const data = {
    type: 'direct',
    user_ids: ['admin', 'other'],
    name: null,
    avatar_url: null,
    created_by: null,
    admin_ids: [],
    participants: { admin: wire(1), other: wire(2) },
    unread_counts: { admin: 0, other: 0 },
    last_message: null,
    last_message_at: ts(0),
    created_at: ts(0),
    updated_at: ts(1000),
  };
  await setDoc(doc(db, 'chats', id), data);
  return { id, data };
}

async function raw(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.exists() ? snap.data() : null;
}

async function messages(chatId) {
  const snap = await getDocs(collection(db, 'chats', chatId, 'chat_messages'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function expectUntouched(chatId, seed) {
  expect(await raw(chatId)).toEqual(seed);
  expect(await messages(chatId)).toHaveLength(0);
}

function expectSystemMessage(m, chatId, kind, actorId, targetId) {
  expect(m.type).toBe('system');
  expect(m.chat_id).toBe(chatId);
  expect(m.author_id).toBeNull();
  expect(m.author_snapshot).toBeNull();
  expect(m.message).toBeNull();
  expect(m.system_event).toEqual({ kind, actor_id: actorId, target_ids: [targetId] });
  expect(m.is_deleted).toBe(false);
  expect(typeof m.created_at.toDate).toBe('function');
  expect(typeof m.updated_at.toDate).toBe('function');
  expect(Math.abs(m.created_at.toMillis() - Date.now())).toBeLessThan(60_000);
}

function expectOthersUntouched(s, data, goneIds) {
  expect(s.type).toBe('group');
  expect(s.name).toBe(data.name);
  expect(s.avatar_url).toBe(data.avatar_url);
  expect(s.created_by).toBe(data.created_by);
  expect(s.last_message).toEqual(data.last_message);
  expect(s.last_message).not.toBeNull();
  expect(s.last_message_at.isEqual(data.last_message_at)).toBe(true);
  expect(s.created_at.isEqual(data.created_at)).toBe(true);
  expect(typeof s.updated_at.toDate).toBe('function');
  expect(s.updated_at.toMillis()).toBeGreaterThan(data.updated_at.toMillis());
  expect(Math.abs(s.updated_at.toMillis() - Date.now())).toBeLessThan(60_000);
  const remaining = data.user_ids.filter((u) => !goneIds.includes(u));
  const expectedP = {};
  const expectedU = {};
  for (const u of remaining) {
    expectedP[u] = data.participants[u];
    expectedU[u] = data.unread_counts[u];
  }
  expect(s.participants).toEqual(expectedP);
  expect(s.unread_counts).toEqual(expectedU);
}

const extras = (n, prefix = 'e') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

async function service() {
  const s = await loadChatService();
  expect(typeof s.leaveGroupChat).toBe('function');
  return s;
}

async function leave(chatId, userId) {
  const s = await service();
  return s.leaveGroupChat(chatId, userId);
}

async function expectRejected(code, chatId, seed, userId) {
  await service();
  let error;
  try {
    await leave(chatId, userId);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  if (seed) await expectUntouched(chatId, seed);
}

describe('leaveGroupChat success (AC#7, rule 5)', () => {
  test('plain member leaves: order preserved, entries deleted, updated_at bumped', async () => {
    const { id, data } = await seedGroup({}, ['x1', 'x2']);
    const result = await leave(id, 'plain');
    expect(result).toBeUndefined();
    const s = await raw(id);
    expect(s.user_ids).toEqual(['admin', 'mod', 'x1', 'x2']);
    expect('plain' in s.participants).toBe(false);
    expect('plain' in s.unread_counts).toBe(false);
    expect(s.admin_ids).toEqual(['admin', 'mod']);
    expectOthersUntouched(s, data, ['plain']);
  });

  test('order of the others is not re-sorted when a middle member leaves', async () => {
    const { id } = await seedGroup({ userIds: ['admin', 'zed', 'mod', 'amy', 'plain', 'bob'] });
    await leave(id, 'zed');
    expect((await raw(id)).user_ids).toEqual(['admin', 'mod', 'amy', 'plain', 'bob']);
  });

  test('an admin can leave while another admin remains; removed from admin_ids', async () => {
    const { id, data } = await seedGroup({ data: { admin_ids: ['admin', 'mod', 'plain'] } }, ['x1']);
    await leave(id, 'mod');
    const s = await raw(id);
    expect(s.user_ids).toEqual(['admin', 'plain', 'x1']);
    expect(s.admin_ids).toEqual(['admin', 'plain']);
    expectOthersUntouched(s, data, ['mod']);
  });

  test('the creator can leave while another admin remains', async () => {
    const { id } = await seedGroup();
    await leave(id, 'admin');
    const s = await raw(id);
    expect(s.user_ids).toEqual(['mod', 'plain']);
    expect(s.admin_ids).toEqual(['mod']);
    expect(s.created_by).toBe('admin');
  });

  test('leaving a 2-member group leaves a 1-member group', async () => {
    const { id, data } = await seedGroup({
      userIds: ['a', 'b'],
      data: { admin_ids: ['a', 'b'], created_by: 'a' },
    });
    await leave(id, 'a');
    const s = await raw(id);
    expect(s.user_ids).toEqual(['b']);
    expect(s.admin_ids).toEqual(['b']);
    expect(Object.keys(s.participants)).toEqual(['b']);
    expect(Object.keys(s.unread_counts)).toEqual(['b']);
    expect(s.unread_counts.b).toBe(data.unread_counts.b);
    expect(await messages(id)).toHaveLength(1);
  });

  test('leaving a 100-member group keeps the order of the other 99', async () => {
    const { id, data } = await seedGroup({}, extras(97));
    await leave(id, 'plain');
    const s = await raw(id);
    expect(s.user_ids).toEqual(data.user_ids.filter((u) => u !== 'plain'));
    expect(s.user_ids).toHaveLength(99);
  });

  test('does not touch another chat', async () => {
    const { id } = await seedGroup();
    const other = await seedGroup();
    await leave(id, 'plain');
    expect(await raw(other.id)).toEqual(other.data);
    expect(await messages(other.id)).toHaveLength(0);
  });
});

describe('leaveGroupChat system message (AC#7, rule 9)', () => {
  test('writes exactly one member_left message', async () => {
    const { id } = await seedGroup();
    await leave(id, 'plain');
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expectSystemMessage(msgs[0], id, 'member_left', 'plain', 'plain');
  });

  test('does not change last_message, last_message_at or remaining unread counters', async () => {
    const { id, data } = await seedGroup({}, ['x1']);
    await leave(id, 'x1');
    const s = await raw(id);
    expect(s.last_message).toEqual(data.last_message);
    expect(s.last_message_at.isEqual(data.last_message_at)).toBe(true);
    expect(s.unread_counts).toEqual({
      admin: data.unread_counts.admin,
      mod: data.unread_counts.mod,
      plain: data.unread_counts.plain,
    });
    expect(Object.values(s.unread_counts).every((n) => n > 0)).toBe(true);
  });
});

describe('leaveGroupChat empty group (AC#9, rule 7)', () => {
  test('last member leaving leaves an empty group in place with a member_left message', async () => {
    const { id, data } = await seedGroup({ userIds: ['solo'], data: { admin_ids: ['solo'], created_by: 'solo' } });
    await leave(id, 'solo');
    const s = await raw(id);
    expect(s).not.toBeNull();
    expect(s.user_ids).toEqual([]);
    expect(s.admin_ids).toEqual([]);
    expect(s.participants).toEqual({});
    expect(s.unread_counts).toEqual({});
    expect(s.type).toBe('group');
    expect(s.name).toBe(data.name);
    expect(s.last_message).toEqual(data.last_message);
    expect(s.updated_at.toMillis()).toBeGreaterThan(data.updated_at.toMillis());
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expectSystemMessage(msgs[0], id, 'member_left', 'solo', 'solo');
  });

  test('members leaving one after another down to empty', async () => {
    const { id } = await seedGroup({
      userIds: ['a', 'b'],
      data: { admin_ids: ['a', 'b'], created_by: 'a' },
    });
    await leave(id, 'a');
    await leave(id, 'b');
    const s = await raw(id);
    expect(s.user_ids).toEqual([]);
    expect(s.admin_ids).toEqual([]);
    expect(s.participants).toEqual({});
    expect(s.unread_counts).toEqual({});
    expect(await messages(id)).toHaveLength(2);
  });
});

describe('leaveGroupChat guards (AC#2, AC#7 and error codes)', () => {
  test('missing chat rejects with CHAT_NOT_FOUND and creates nothing', async () => {
    const chatId = nextId('missing');
    await expectRejected('CHAT_NOT_FOUND', chatId, null, 'plain');
    expect(await raw(chatId)).toBeNull();
    expect(await messages(chatId)).toHaveLength(0);
  });

  test('direct chat rejects with CHAT_NOT_GROUP', async () => {
    const { id, data } = await seedDirect();
    await expectRejected('CHAT_NOT_GROUP', id, data, 'admin');
  });

  test('non-member rejects with CHAT_NOT_PARTICIPANT and writes nothing', async () => {
    const { id, data } = await seedGroup();
    await expectRejected('CHAT_NOT_PARTICIPANT', id, data, 'stranger');
  });

  test('leaving twice: second call rejects with CHAT_NOT_PARTICIPANT and writes nothing more', async () => {
    const { id } = await seedGroup();
    await leave(id, 'plain');
    const after = await raw(id);
    await expectRejected('CHAT_NOT_PARTICIPANT', id, null, 'plain');
    expect(await raw(id)).toEqual(after);
    expect(await messages(id)).toHaveLength(1);
  });
});

describe('leaveGroupChat concurrency', () => {
  test('two members leaving concurrently: both gone, two messages, nothing resurrected', async () => {
    const { id, data } = await seedGroup({}, ['x1', 'x2']);
    const s = await service();
    await Promise.all([s.leaveGroupChat(id, 'plain'), s.leaveGroupChat(id, 'x1')]);
    const stored = await raw(id);
    expect(stored.user_ids).toEqual(['admin', 'mod', 'x2']);
    expect(Object.keys(stored.participants).sort()).toEqual(['admin', 'mod', 'x2']);
    expect(Object.keys(stored.unread_counts).sort()).toEqual(['admin', 'mod', 'x2']);
    expect(stored.unread_counts.x2).toBe(data.unread_counts.x2);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.system_event.actor_id).sort()).toEqual(['plain', 'x1']);
  });
});
