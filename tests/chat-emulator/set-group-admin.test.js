import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

let counter = 0;
const nextId = (p = 'sga') => `${p}-${Date.now()}-${++counter}`;

const SEED_MS = 1_700_000_000_000;
const ts = (offset = 0) => Timestamp.fromMillis(SEED_MS + offset);
const wire = (n) => ({ full_name: `User ${n}`, avatar_url: n % 2 ? `http://x/${n}.png` : null });

async function seedGroup({ userIds, adminIds, createdBy }) {
  const id = nextId();
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
    created_by: createdBy ?? userIds[0],
    admin_ids: adminIds,
    participants,
    unread_counts: unread,
    last_message: { text: 'hello', author_id: userIds[userIds.length - 1], type: 'text', created_at: ts(500) },
    last_message_at: ts(500),
    created_at: ts(0),
    updated_at: ts(1000),
  };
  await setDoc(doc(db, 'chats', id), data);
  return { id, data };
}

async function seedDirect() {
  const id = nextId('dm');
  const data = {
    type: 'direct',
    user_ids: ['a', 'b'],
    name: null,
    avatar_url: null,
    created_by: null,
    admin_ids: [],
    participants: { a: wire(1), b: wire(2) },
    unread_counts: { a: 1, b: 2 },
    last_message: { text: 'hi', author_id: 'b', type: 'text', created_at: ts(500) },
    last_message_at: ts(500),
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
  expect(typeof s.setGroupAdmin).toBe('function');
  return s;
}

async function setAdmin(chatId, actorId, targetId, isAdmin) {
  return (await service()).setGroupAdmin(chatId, actorId, targetId, isAdmin);
}

async function rejection(promise) {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  return null;
}

async function expectRejects(promise, code) {
  const err = await rejection(promise);
  expect(err).toBeInstanceOf(Error);
  expect(err.code).toBe(code);
}

async function expectUntouched(id, data) {
  const s = await raw(id);
  expect(s).toEqual(data);
  expect(s.updated_at.isEqual(data.updated_at)).toBe(true);
  expect(await messages(id)).toHaveLength(0);
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

// Fields setGroupAdmin must never change.
function expectInvariants(s, data) {
  expect(s.user_ids).toEqual(data.user_ids);
  expect(s.participants).toEqual(data.participants);
  expect(s.unread_counts).toEqual(data.unread_counts);
  expect(s.name).toBe(data.name);
  expect(s.avatar_url).toBe(data.avatar_url);
  expect(s.created_by).toBe(data.created_by);
  expect(s.type).toBe('group');
  expect(s.last_message).toEqual(data.last_message);
  expect(s.last_message_at.isEqual(data.last_message_at)).toBe(true);
  expect(s.created_at.isEqual(data.created_at)).toBe(true);
}

async function expectChange(id, data, kind, actorId, targetId, expectedAdmins) {
  const s = await raw(id);
  expect(s.admin_ids).toEqual(expectedAdmins);
  expectInvariants(s, data);
  expect(s.updated_at.toMillis()).toBeGreaterThan(data.updated_at.toMillis());
  const msgs = await messages(id);
  expect(msgs).toHaveLength(1);
  expectSystemMessage(msgs[0], id, kind, actorId, targetId);
}

describe('setGroupAdmin promote (spec 3.2, AC#5)', () => {
  test('admin promotes a plain member: appended, admin_promoted message, updated_at bumped', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expect(setAdmin(id, 'a', 'b', true)).resolves.toBeUndefined();
    await expectChange(id, data, 'admin_promoted', 'a', 'b', ['a', 'b']);
  });

  test('second promotion appends after existing admins (order kept)', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c', 'd'], adminIds: ['a'] });
    await setAdmin(id, 'a', 'c', true);
    await setAdmin(id, 'a', 'b', true);
    const s = await raw(id);
    expect(s.admin_ids).toEqual(['a', 'c', 'b']);
    expectInvariants(s, data);
    const msgs = await messages(id);
    expect(msgs.filter((m) => m.system_event?.kind === 'admin_promoted')).toHaveLength(2);
  });

  test('non-creator admin can promote', async () => {
    const { id, data } = await seedGroup({ userIds: ['creator', 'adm', 'c'], adminIds: ['creator', 'adm'], createdBy: 'creator' });
    await setAdmin(id, 'adm', 'c', true);
    await expectChange(id, data, 'admin_promoted', 'adm', 'c', ['creator', 'adm', 'c']);
  });
});

describe('setGroupAdmin demote (spec 3.2, AC#8)', () => {
  test('admin demotes another admin (2 -> 1), others keep order', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b', 'c'] });
    await setAdmin(id, 'a', 'b', false);
    await expectChange(id, data, 'admin_demoted', 'a', 'b', ['a', 'c']);
  });

  test('admin demotes themself when another admin exists', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b'] });
    await setAdmin(id, 'a', 'a', false);
    await expectChange(id, data, 'admin_demoted', 'a', 'a', ['b']);
  });

  test('creator demoted by another admin: created_by unchanged', async () => {
    const { id, data } = await seedGroup({ userIds: ['creator', 'adm', 'c'], adminIds: ['creator', 'adm'], createdBy: 'creator' });
    await setAdmin(id, 'adm', 'creator', false);
    await expectChange(id, data, 'admin_demoted', 'adm', 'creator', ['adm']);
    expect((await raw(id)).created_by).toBe('creator');
  });

  test('promote then demote ends with the original admin_ids', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await setAdmin(id, 'a', 'b', true);
    await setAdmin(id, 'a', 'b', false);
    expect((await raw(id)).admin_ids).toEqual(['a']);
    const kinds = (await messages(id)).map((m) => m.system_event.kind).sort();
    expect(kinds).toEqual(['admin_demoted', 'admin_promoted']);
  });
});

describe('setGroupAdmin rejections write nothing', () => {
  test('missing chat -> CHAT_NOT_FOUND', async () => {
    const id = nextId('missing');
    await expectRejects(setAdmin(id, 'a', 'b', true), 'CHAT_NOT_FOUND');
    expect(await raw(id)).toBeNull();
    expect(await messages(id)).toHaveLength(0);
  });

  test('direct chat -> CHAT_NOT_GROUP (promote and demote)', async () => {
    const { id, data } = await seedDirect();
    await expectRejects(setAdmin(id, 'a', 'b', true), 'CHAT_NOT_GROUP');
    await expectRejects(setAdmin(id, 'a', 'b', false), 'CHAT_NOT_GROUP');
    await expectUntouched(id, data);
  });

  test('plain member actor -> CHAT_NOT_ADMIN (promote)', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expectRejects(setAdmin(id, 'b', 'c', true), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });

  test('plain member actor -> CHAT_NOT_ADMIN (demote)', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expectRejects(setAdmin(id, 'b', 'a', false), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });

  test('plain member actor demoting a non-admin still gets CHAT_NOT_ADMIN', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expectRejects(setAdmin(id, 'b', 'c', false), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });

  test('non-member actor -> CHAT_NOT_ADMIN', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expectRejects(setAdmin(id, 'outsider', 'b', true), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });

  test('target not in user_ids -> CHAT_NOT_PARTICIPANT', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expectRejects(setAdmin(id, 'a', 'outsider', true), 'CHAT_NOT_PARTICIPANT');
    await expectRejects(setAdmin(id, 'a', 'outsider', false), 'CHAT_NOT_PARTICIPANT');
    await expectUntouched(id, data);
  });

  test('sole admin demotes themself -> CHAT_LAST_ADMIN', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expectRejects(setAdmin(id, 'a', 'a', false), 'CHAT_LAST_ADMIN');
    await expectUntouched(id, data);
  });

  test('sole admin of a 1-member group demotes themself -> CHAT_LAST_ADMIN', async () => {
    const { id, data } = await seedGroup({ userIds: ['a'], adminIds: ['a'] });
    await expectRejects(setAdmin(id, 'a', 'a', false), 'CHAT_LAST_ADMIN');
    await expectUntouched(id, data);
  });
});

describe('setGroupAdmin no-ops (no writes)', () => {
  test('promoting someone who is already an admin', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b'] });
    await expect(setAdmin(id, 'a', 'b', true)).resolves.toBeUndefined();
    await expectUntouched(id, data);
  });

  test('promoting yourself when already admin', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b'], adminIds: ['a'] });
    await expect(setAdmin(id, 'a', 'a', true)).resolves.toBeUndefined();
    await expectUntouched(id, data);
  });

  test('demoting a member who is not an admin (even with a sole admin actor)', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await expect(setAdmin(id, 'a', 'b', false)).resolves.toBeUndefined();
    await expectUntouched(id, data);
  });
});

describe('setGroupAdmin isolation and concurrency', () => {
  test('another chat is untouched', async () => {
    const one = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    const other = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await setAdmin(one.id, 'a', 'b', true);
    await expectUntouched(other.id, other.data);
  });

  test('two admins demoting each other concurrently: exactly one admin left, exactly one call rejects', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b'] });
    const s = await service();
    const results = await Promise.all([
      rejection(s.setGroupAdmin(id, 'a', 'b', false)),
      rejection(s.setGroupAdmin(id, 'b', 'a', false)),
    ]);
    const errors = results.filter((e) => e !== null);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    // Once serialised, the loser is either no longer an admin (NOT_ADMIN) or would orphan the group (LAST_ADMIN).
    expect(['CHAT_LAST_ADMIN', 'CHAT_NOT_ADMIN']).toContain(errors[0].code);
    const stored = await raw(id);
    expect(stored.admin_ids).toHaveLength(1);
    expect(['a', 'b']).toContain(stored.admin_ids[0]);
    expect(await messages(id)).toHaveLength(1);
  });

  test('two admins demoting themselves concurrently: one succeeds, the other gets CHAT_LAST_ADMIN', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b'] });
    const s = await service();
    const results = await Promise.all([
      rejection(s.setGroupAdmin(id, 'a', 'a', false)),
      rejection(s.setGroupAdmin(id, 'b', 'b', false)),
    ]);
    const errors = results.filter((e) => e !== null);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(errors[0].code).toBe('CHAT_LAST_ADMIN');
    expect((await raw(id)).admin_ids).toHaveLength(1);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].system_event.kind).toBe('admin_demoted');
  });

  test('concurrent promotion of the same target by two admins: target appears exactly once', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b'] });
    const s = await service();
    await Promise.all([s.setGroupAdmin(id, 'a', 'c', true), s.setGroupAdmin(id, 'b', 'c', true)]);
    const stored = await raw(id);
    expect(stored.admin_ids.filter((u) => u === 'c')).toHaveLength(1);
    expect([...stored.admin_ids].sort()).toEqual(['a', 'b', 'c']);
    const promoted = (await messages(id)).filter((m) => m.system_event?.kind === 'admin_promoted');
    expect(promoted).toHaveLength(1);
  });
});
