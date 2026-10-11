import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

let counter = 0;
const nextId = (p = 'chat') => `${p}-${Date.now()}-${++counter}`;

const SEED_MS = 1_700_000_000_000;
const ts = (offset = 0) => Timestamp.fromMillis(SEED_MS + offset);
const profile = (n) => ({ fullName: `User ${n}`, avatarUrl: n % 2 ? `http://x/${n}.png` : null });
const member = (id, n = 1) => ({ userId: id, profile: profile(n) });
const wire = (n) => ({ full_name: `User ${n}`, avatar_url: n % 2 ? `http://x/${n}.png` : null });

async function seedGroup(overrides = {}, extraUsers = []) {
  const id = overrides.id ?? nextId();
  const userIds = ['admin', 'mod', 'plain', ...extraUsers];
  const participants = {};
  const unread = {};
  userIds.forEach((u, i) => {
    participants[u] = wire(i + 10);
    unread[u] = 0;
  });
  unread.plain = 5;
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

async function service() {
  const s = await loadChatService();
  expect(typeof s.addGroupMembers).toBe('function');
  return s;
}

async function add(dto) {
  const s = await service();
  return s.addGroupMembers(dto);
}

async function expectUntouched(chatId, seed) {
  expect(await raw(chatId)).toEqual(seed);
  expect(await messages(chatId)).toHaveLength(0);
}

async function expectRejected(code, chatId, seed, dto) {
  await service();
  let error;
  try {
    await add(dto);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  if (seed) await expectUntouched(chatId, seed);
}

function many(count, prefix = 'u') {
  return Array.from({ length: count }, (_, i) => member(`${prefix}${i}`, i));
}

describe('addGroupMembers success (AC#5)', () => {
  test('appends new members in join order with profile and zero counter, bumps updated_at', async () => {
    const { id, data } = await seedGroup();
    const result = await add({ chatId: id, actorId: 'admin', members: [member('zoe', 1), member('adam', 2)] });
    expect(result).toBeUndefined();

    const s = await raw(id);
    expect(s.user_ids).toEqual(['admin', 'mod', 'plain', 'zoe', 'adam']);
    expect(s.participants.zoe).toEqual({ full_name: 'User 1', avatar_url: 'http://x/1.png' });
    expect(s.participants.adam).toEqual({ full_name: 'User 2', avatar_url: null });
    expect(s.unread_counts.zoe).toBe(0);
    expect(s.unread_counts.adam).toBe(0);
    expect(typeof s.updated_at.toDate).toBe('function');
    expect(s.updated_at.toMillis()).toBeGreaterThan(data.updated_at.toMillis());
    expect(Math.abs(s.updated_at.toMillis() - Date.now())).toBeLessThan(60_000);
  });

  test('leaves everything else unchanged and new members are not admins', async () => {
    const { id, data } = await seedGroup();
    await add({ chatId: id, actorId: 'admin', members: [member('zoe', 1)] });
    const s = await raw(id);
    expect(s.type).toBe('group');
    expect(s.name).toBe(data.name);
    expect(s.avatar_url).toBe(data.avatar_url);
    expect(s.created_by).toBe(data.created_by);
    expect(s.admin_ids).toEqual(['admin', 'mod']);
    expect(s.last_message).toEqual(data.last_message);
    expect(s.last_message_at.isEqual(data.last_message_at)).toBe(true);
    expect(s.created_at.isEqual(data.created_at)).toBe(true);
    for (const u of data.user_ids) expect(s.participants[u]).toEqual(data.participants[u]);
    expect(s.unread_counts.plain).toBe(5);
    expect(s.unread_counts.admin).toBe(0);
    expect(Object.keys(s.participants).sort()).toEqual(['admin', 'mod', 'plain', 'zoe']);
    expect(Object.keys(s.unread_counts).sort()).toEqual(['admin', 'mod', 'plain', 'zoe']);
  });

  test('a non-creator admin can add members', async () => {
    const { id } = await seedGroup();
    await add({ chatId: id, actorId: 'mod', members: [member('zoe', 1)] });
    expect((await raw(id)).user_ids).toEqual(['admin', 'mod', 'plain', 'zoe']);
  });

  test('does not touch another chat', async () => {
    const { id } = await seedGroup();
    const other = await seedGroup();
    await add({ chatId: id, actorId: 'admin', members: [member('zoe', 1)] });
    expect(await raw(other.id)).toEqual(other.data);
    expect(await messages(other.id)).toHaveLength(0);
  });
});

describe('addGroupMembers system message (AC#5, AC#9)', () => {
  test('writes exactly one member_added message with all new ids in order', async () => {
    const { id } = await seedGroup();
    await add({
      chatId: id,
      actorId: 'admin',
      members: [member('zoe', 1), member('adam', 2), member('mia', 3)],
    });
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    const m = msgs[0];
    expect(m.type).toBe('system');
    expect(m.chat_id).toBe(id);
    expect(m.author_id).toBeNull();
    expect(m.author_snapshot).toBeNull();
    expect(m.message).toBeNull();
    expect(m.system_event).toEqual({
      kind: 'member_added',
      actor_id: 'admin',
      target_ids: ['zoe', 'adam', 'mia'],
    });
    expect(m.is_deleted).toBe(false);
    expect(typeof m.created_at.toDate).toBe('function');
    expect(typeof m.updated_at.toDate).toBe('function');
    expect(Math.abs(m.created_at.toMillis() - Date.now())).toBeLessThan(60_000);
  });

  test('does not change last_message, last_message_at, or existing unread counters', async () => {
    const { id, data } = await seedGroup();
    await add({ chatId: id, actorId: 'admin', members: [member('zoe', 1)] });
    const s = await raw(id);
    expect(s.last_message).toEqual(data.last_message);
    expect(s.last_message).not.toBeNull();
    expect(s.last_message_at.isEqual(data.last_message_at)).toBe(true);
    expect(s.unread_counts).toEqual({ ...data.unread_counts, zoe: 0 });
  });
});

describe('addGroupMembers de-duplication and existing members', () => {
  test('duplicate input is de-duplicated by userId, first occurrence wins', async () => {
    const { id } = await seedGroup();
    await add({
      chatId: id,
      actorId: 'admin',
      members: [
        member('zoe', 1),
        member('adam', 2),
        { userId: 'zoe', profile: { fullName: 'Other Zoe', avatarUrl: null } },
        member('adam', 4),
      ],
    });
    const s = await raw(id);
    expect(s.user_ids).toEqual(['admin', 'mod', 'plain', 'zoe', 'adam']);
    expect(s.participants.zoe).toEqual({ full_name: 'User 1', avatar_url: 'http://x/1.png' });
    expect(s.participants.adam).toEqual({ full_name: 'User 2', avatar_url: null });
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].system_event.target_ids).toEqual(['zoe', 'adam']);
  });

  test('existing members in input are ignored: not overwritten, not reset, not in target_ids', async () => {
    const { id, data } = await seedGroup();
    await add({
      chatId: id,
      actorId: 'admin',
      members: [
        { userId: 'plain', profile: { fullName: 'Changed', avatarUrl: 'http://x/changed.png' } },
        member('zoe', 1),
        member('admin', 7),
      ],
    });
    const s = await raw(id);
    expect(s.user_ids).toEqual(['admin', 'mod', 'plain', 'zoe']);
    expect(s.participants.plain).toEqual(data.participants.plain);
    expect(s.participants.admin).toEqual(data.participants.admin);
    expect(s.unread_counts.plain).toBe(5);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].system_event.target_ids).toEqual(['zoe']);
  });
});

describe('addGroupMembers no-op', () => {
  test('empty members resolves without any writes', async () => {
    const { id, data } = await seedGroup();
    await add({ chatId: id, actorId: 'admin', members: [] });
    await expectUntouched(id, data);
  });

  test('all members already present resolves without any writes', async () => {
    const { id, data } = await seedGroup();
    await add({ chatId: id, actorId: 'admin', members: [member('plain', 3), member('mod', 4), member('plain', 3)] });
    await expectUntouched(id, data);
  });
});

describe('addGroupMembers capacity (AC#6)', () => {
  test('exactly 100 total is accepted', async () => {
    const { id } = await seedGroup({}, many(95, 'e').map((m) => m.userId)); // 98 existing
    await add({ chatId: id, actorId: 'admin', members: many(2, 'n') });
    const s = await raw(id);
    expect(s.user_ids).toHaveLength(100);
    expect(Object.keys(s.participants)).toHaveLength(100);
    expect(Object.keys(s.unread_counts)).toHaveLength(100);
    expect(await messages(id)).toHaveLength(1);
  });

  test('101 total rejects with CHAT_GROUP_FULL and writes nothing', async () => {
    const { id, data } = await seedGroup({}, many(95, 'e').map((m) => m.userId));
    await expectRejected('CHAT_GROUP_FULL', id, data, { chatId: id, actorId: 'admin', members: many(3, 'n') });
  });

  test('duplicates and existing members do not count toward the total', async () => {
    const { id } = await seedGroup({}, many(95, 'e').map((m) => m.userId));
    await add({
      chatId: id,
      actorId: 'admin',
      members: [...many(2, 'n'), ...many(2, 'n'), member('plain', 1), member('e0', 1), member('admin', 1)],
    });
    expect((await raw(id)).user_ids).toHaveLength(100);
  });

  test('adding only existing members to a full 100-member group is a no-op', async () => {
    const { id, data } = await seedGroup({}, many(97, 'e').map((m) => m.userId));
    expect(data.user_ids).toHaveLength(100);
    await add({ chatId: id, actorId: 'admin', members: [member('plain', 1), member('e3', 2)] });
    await expectUntouched(id, data);
  });

  test('a new member on a full 100-member group rejects with CHAT_GROUP_FULL', async () => {
    const { id, data } = await seedGroup({}, many(97, 'e').map((m) => m.userId));
    await expectRejected('CHAT_GROUP_FULL', id, data, { chatId: id, actorId: 'admin', members: [member('new1', 1)] });
  });
});

describe('addGroupMembers guards (AC#2, AC#3)', () => {
  test('missing chat rejects with CHAT_NOT_FOUND and creates nothing', async () => {
    const chatId = nextId('missing');
    await expectRejected('CHAT_NOT_FOUND', chatId, null, { chatId, actorId: 'admin', members: [member('zoe', 1)] });
    expect(await raw(chatId)).toBeNull();
    expect(await messages(chatId)).toHaveLength(0);
  });

  test('direct chat rejects with CHAT_NOT_GROUP', async () => {
    const { id, data } = await seedDirect();
    await expectRejected('CHAT_NOT_GROUP', id, data, { chatId: id, actorId: 'admin', members: [member('zoe', 1)] });
  });

  test('group check precedes admin check on a direct chat with a non-admin actor', async () => {
    const { id, data } = await seedDirect();
    await expectRejected('CHAT_NOT_GROUP', id, data, { chatId: id, actorId: 'other', members: [member('zoe', 1)] });
  });

  test('plain member rejects with CHAT_NOT_ADMIN', async () => {
    const { id, data } = await seedGroup();
    await expectRejected('CHAT_NOT_ADMIN', id, data, { chatId: id, actorId: 'plain', members: [member('zoe', 1)] });
  });

  test('non-member rejects with CHAT_NOT_ADMIN', async () => {
    const { id, data } = await seedGroup();
    await expectRejected('CHAT_NOT_ADMIN', id, data, { chatId: id, actorId: 'stranger', members: [member('zoe', 1)] });
  });

  test('admin check precedes capacity check', async () => {
    const { id, data } = await seedGroup({}, many(95, 'e').map((m) => m.userId));
    await expectRejected('CHAT_NOT_ADMIN', id, data, { chatId: id, actorId: 'plain', members: many(3, 'n') });
  });
});

describe('addGroupMembers ordering and concurrency', () => {
  test('sequential calls append in call order with one message each', async () => {
    const { id } = await seedGroup();
    await add({ chatId: id, actorId: 'admin', members: [member('zoe', 1)] });
    await add({ chatId: id, actorId: 'mod', members: [member('adam', 2), member('mia', 3)] });
    const s = await raw(id);
    expect(s.user_ids).toEqual(['admin', 'mod', 'plain', 'zoe', 'adam', 'mia']);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.system_event.actor_id).sort()).toEqual(['admin', 'mod']);
  });

  test('two admins adding different members concurrently keep both sets without duplicates', async () => {
    const { id } = await seedGroup();
    const s = await service();
    await Promise.all([
      s.addGroupMembers({ chatId: id, actorId: 'admin', members: [member('zoe', 1), member('adam', 2)] }),
      s.addGroupMembers({ chatId: id, actorId: 'mod', members: [member('mia', 3), member('leo', 4)] }),
    ]);
    const stored = await raw(id);
    expect(stored.user_ids).toHaveLength(7);
    expect(new Set(stored.user_ids).size).toBe(7);
    expect(stored.user_ids.slice(0, 3)).toEqual(['admin', 'mod', 'plain']);
    expect([...stored.user_ids.slice(3)].sort()).toEqual(['adam', 'leo', 'mia', 'zoe']);
    for (const u of ['zoe', 'adam', 'mia', 'leo']) {
      expect(stored.participants[u]).toBeDefined();
      expect(stored.unread_counts[u]).toBe(0);
    }
    expect(stored.unread_counts.plain).toBe(5);
    expect(await messages(id)).toHaveLength(2);
  });
});
