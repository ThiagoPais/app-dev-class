import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

let counter = 0;
const nextId = (p = 'ugi') => `${p}-${Date.now()}-${++counter}`;

const SEED_MS = 1_700_000_000_000;
const ts = (offset = 0) => Timestamp.fromMillis(SEED_MS + offset);
const wire = (n) => ({ full_name: `User ${n}`, avatar_url: n % 2 ? `http://x/${n}.png` : null });

async function seedGroup({ userIds = ['a', 'b', 'c'], adminIds = ['a'], createdBy, name = 'Study group', avatarUrl = 'http://x/g.png' } = {}) {
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
    name,
    avatar_url: avatarUrl,
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
  expect(typeof s.updateGroupInfo).toBe('function');
  return s;
}

async function update(dto) {
  return (await service()).updateGroupInfo(dto);
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

function expectRenamedMessage(m, chatId, actorId) {
  expect(m.type).toBe('system');
  expect(m.chat_id).toBe(chatId);
  expect(m.author_id).toBeNull();
  expect(m.author_snapshot).toBeNull();
  expect(m.message).toBeNull();
  expect(m.system_event).toEqual({ kind: 'group_renamed', actor_id: actorId, target_ids: [] });
  expect(m.is_deleted).toBe(false);
  expect(typeof m.created_at.toDate).toBe('function');
  expect(typeof m.updated_at.toDate).toBe('function');
  expect(Math.abs(m.created_at.toMillis() - Date.now())).toBeLessThan(60_000);
}

// Fields updateGroupInfo must never change.
function expectInvariants(s, data) {
  expect(s.user_ids).toEqual(data.user_ids);
  expect(s.admin_ids).toEqual(data.admin_ids);
  expect(s.participants).toEqual(data.participants);
  expect(s.unread_counts).toEqual(data.unread_counts);
  expect(s.created_by).toBe(data.created_by);
  expect(s.type).toBe('group');
  expect(s.last_message).toEqual(data.last_message);
  expect(s.last_message_at.isEqual(data.last_message_at)).toBe(true);
  expect(s.created_at.isEqual(data.created_at)).toBe(true);
}

async function expectBumped(id, data) {
  const s = await raw(id);
  expect(s.updated_at.toMillis()).toBeGreaterThan(data.updated_at.toMillis());
  return s;
}

describe('updateGroupInfo rename (spec 3.2, AC#5)', () => {
  test('admin renames: trimmed name stored, updated_at bumped, one group_renamed message', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a', name: '  New name  ' })).toBeUndefined();
    const s = await expectBumped(id, data);
    expect(s.name).toBe('New name');
    expect(s.avatar_url).toBe(data.avatar_url);
    expectInvariants(s, data);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expectRenamedMessage(msgs[0], id, 'a');
  });

  test('non-creator admin can rename', async () => {
    const { id, data } = await seedGroup({ adminIds: ['a', 'b'], createdBy: 'a' });
    await update({ chatId: id, actorId: 'b', name: 'By b' });
    const s = await expectBumped(id, data);
    expect(s.name).toBe('By b');
    expectInvariants(s, data);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expectRenamedMessage(msgs[0], id, 'b');
  });

  test('name of exactly 60 chars is accepted', async () => {
    const { id, data } = await seedGroup();
    const name = 'x'.repeat(60);
    await update({ chatId: id, actorId: 'a', name });
    expect((await raw(id)).name).toBe(name);
    expect(await messages(id)).toHaveLength(1);
    expectInvariants(await raw(id), data);
  });

  test('60 chars plus surrounding whitespace is accepted and trimmed', async () => {
    const { id } = await seedGroup();
    const name = 'y'.repeat(60);
    await update({ chatId: id, actorId: 'a', name: `  ${name}\n ` });
    expect((await raw(id)).name).toBe(name);
  });

  test('sequential renames each add one message', async () => {
    const { id } = await seedGroup();
    await update({ chatId: id, actorId: 'a', name: 'One' });
    await update({ chatId: id, actorId: 'a', name: 'Two' });
    expect((await raw(id)).name).toBe('Two');
    const msgs = await messages(id);
    expect(msgs).toHaveLength(2);
    msgs.forEach((m) => expectRenamedMessage(m, id, 'a'));
  });

  test('renaming to a different-case name counts as a change', async () => {
    const { id, data } = await seedGroup({ name: 'Study group' });
    await update({ chatId: id, actorId: 'a', name: 'STUDY GROUP' });
    const s = await expectBumped(id, data);
    expect(s.name).toBe('STUDY GROUP');
    expect(await messages(id)).toHaveLength(1);
  });

  test('rename with avatarUrl equal to current still renames (avatar unchanged, one message)', async () => {
    const { id, data } = await seedGroup();
    await update({ chatId: id, actorId: 'a', name: 'Different', avatarUrl: data.avatar_url });
    const s = await expectBumped(id, data);
    expect(s.name).toBe('Different');
    expect(s.avatar_url).toBe(data.avatar_url);
    expectInvariants(s, data);
    expect(await messages(id)).toHaveLength(1);
  });
});

describe('updateGroupInfo avatar (spec 3.2, AC#5)', () => {
  test('avatar string: avatar_url updated, updated_at bumped, NO system message', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a', avatarUrl: 'http://x/new.png' })).toBeUndefined();
    const s = await expectBumped(id, data);
    expect(s.avatar_url).toBe('http://x/new.png');
    expect(s.name).toBe(data.name);
    expectInvariants(s, data);
    expect(await messages(id)).toHaveLength(0);
  });

  test('avatar null clears the picture, no system message', async () => {
    const { id, data } = await seedGroup();
    await update({ chatId: id, actorId: 'a', avatarUrl: null });
    const s = await expectBumped(id, data);
    expect(s.avatar_url).toBeNull();
    expect(s.name).toBe(data.name);
    expectInvariants(s, data);
    expect(await messages(id)).toHaveLength(0);
  });

  test('avatar set on a group that had none', async () => {
    const { id, data } = await seedGroup({ avatarUrl: null });
    await update({ chatId: id, actorId: 'a', avatarUrl: 'http://x/first.png' });
    const s = await expectBumped(id, data);
    expect(s.avatar_url).toBe('http://x/first.png');
    expect(await messages(id)).toHaveLength(0);
  });

  test('name and avatar together: one update, one group_renamed message', async () => {
    const { id, data } = await seedGroup();
    await update({ chatId: id, actorId: 'a', name: 'Both', avatarUrl: 'http://x/both.png' });
    const s = await expectBumped(id, data);
    expect(s.name).toBe('Both');
    expect(s.avatar_url).toBe('http://x/both.png');
    expectInvariants(s, data);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expectRenamedMessage(msgs[0], id, 'a');
  });
});

describe('updateGroupInfo validation (CHAT_GROUP_NAME_INVALID, AC#9)', () => {
  for (const [label, name] of [
    ['empty', ''],
    ['whitespace only', '   \t\n '],
    ['61 chars', 'z'.repeat(61)],
    ['61 chars after trimming', `  ${'z'.repeat(61)}  `],
  ]) {
    test(`name ${label} -> CHAT_GROUP_NAME_INVALID, nothing written`, async () => {
      const { id, data } = await seedGroup();
      expect(typeof (await service()).updateGroupInfo).toBe('function');
      await expectRejects(update({ chatId: id, actorId: 'a', name }), 'CHAT_GROUP_NAME_INVALID');
      await expectUntouched(id, data);
    });
  }

  test('invalid name together with a valid avatar writes nothing', async () => {
    const { id, data } = await seedGroup();
    await expectRejects(update({ chatId: id, actorId: 'a', name: ' ', avatarUrl: 'http://x/n.png' }), 'CHAT_GROUP_NAME_INVALID');
    await expectUntouched(id, data);
  });

  test('name validation runs before any read: missing chat with invalid name -> CHAT_GROUP_NAME_INVALID', async () => {
    const id = nextId('missing');
    await expectRejects(update({ chatId: id, actorId: 'a', name: '' }), 'CHAT_GROUP_NAME_INVALID');
    expect(await raw(id)).toBeNull();
  });

  test('name validation runs before the admin check', async () => {
    const { id, data } = await seedGroup();
    await expectRejects(update({ chatId: id, actorId: 'b', name: '' }), 'CHAT_GROUP_NAME_INVALID');
    await expectUntouched(id, data);
  });
});

describe('updateGroupInfo rejections write nothing (AC#9)', () => {
  test('missing chat -> CHAT_NOT_FOUND', async () => {
    const id = nextId('missing');
    expect(typeof (await service()).updateGroupInfo).toBe('function');
    await expectRejects(update({ chatId: id, actorId: 'a', name: 'X' }), 'CHAT_NOT_FOUND');
    expect(await raw(id)).toBeNull();
    expect(await messages(id)).toHaveLength(0);
  });

  test('direct chat -> CHAT_NOT_GROUP (even for a participant, name and avatar)', async () => {
    const { id, data } = await seedDirect();
    expect(typeof (await service()).updateGroupInfo).toBe('function');
    await expectRejects(update({ chatId: id, actorId: 'a', name: 'X' }), 'CHAT_NOT_GROUP');
    await expectRejects(update({ chatId: id, actorId: 'a', avatarUrl: 'http://x/a.png' }), 'CHAT_NOT_GROUP');
    await expectUntouched(id, data);
  });

  test('plain member -> CHAT_NOT_ADMIN (rename)', async () => {
    const { id, data } = await seedGroup();
    expect(typeof (await service()).updateGroupInfo).toBe('function');
    await expectRejects(update({ chatId: id, actorId: 'b', name: 'Hijack' }), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });

  test('plain member -> CHAT_NOT_ADMIN (avatar)', async () => {
    const { id, data } = await seedGroup();
    expect(typeof (await service()).updateGroupInfo).toBe('function');
    await expectRejects(update({ chatId: id, actorId: 'b', avatarUrl: null }), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });

  test('non-member -> CHAT_NOT_ADMIN', async () => {
    const { id, data } = await seedGroup();
    expect(typeof (await service()).updateGroupInfo).toBe('function');
    await expectRejects(update({ chatId: id, actorId: 'outsider', name: 'Hijack' }), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });

  test('non-admin attempting a no-op change is still rejected with CHAT_NOT_ADMIN', async () => {
    const { id, data } = await seedGroup();
    expect(typeof (await service()).updateGroupInfo).toBe('function');
    await expectRejects(update({ chatId: id, actorId: 'b', name: data.name }), 'CHAT_NOT_ADMIN');
    await expectUntouched(id, data);
  });
});

describe('updateGroupInfo no-ops (no writes)', () => {
  test('neither field provided', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a' })).toBeUndefined();
    await expectUntouched(id, data);
  });

  test('same name', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a', name: data.name })).toBeUndefined();
    await expectUntouched(id, data);
  });

  test('same name after trimming', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a', name: `  ${data.name}  ` })).toBeUndefined();
    await expectUntouched(id, data);
  });

  test('same name and same avatar', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a', name: data.name, avatarUrl: data.avatar_url })).toBeUndefined();
    await expectUntouched(id, data);
  });

  test('same avatar only', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a', avatarUrl: data.avatar_url })).toBeUndefined();
    await expectUntouched(id, data);
  });

  test('avatar null when already null', async () => {
    const { id, data } = await seedGroup({ avatarUrl: null });
    expect(await update({ chatId: id, actorId: 'a', avatarUrl: null })).toBeUndefined();
    await expectUntouched(id, data);
  });

  test('same name with explicitly undefined avatar', async () => {
    const { id, data } = await seedGroup();
    expect(await update({ chatId: id, actorId: 'a', name: data.name, avatarUrl: undefined })).toBeUndefined();
    await expectUntouched(id, data);
  });
});

describe('updateGroupInfo isolation and concurrency', () => {
  test('another chat is untouched', async () => {
    const one = await seedGroup();
    const other = await seedGroup();
    await update({ chatId: one.id, actorId: 'a', name: 'Only one' });
    await expectUntouched(other.id, other.data);
  });

  test('two admins renaming concurrently: one of the names stored, 2 group_renamed messages', async () => {
    const { id, data } = await seedGroup({ adminIds: ['a', 'b'], createdBy: 'a' });
    const s = await service();
    const results = await Promise.all([
      rejection(s.updateGroupInfo({ chatId: id, actorId: 'a', name: 'Name A' })),
      rejection(s.updateGroupInfo({ chatId: id, actorId: 'b', name: 'Name B' })),
    ]);
    expect(results).toEqual([null, null]);
    const stored = await raw(id);
    expect(['Name A', 'Name B']).toContain(stored.name);
    expectInvariants(stored, data);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(2);
    msgs.forEach((m) => expect(m.system_event.kind).toBe('group_renamed'));
    expect(msgs.map((m) => m.system_event.actor_id).sort()).toEqual(['a', 'b']);
  });
});
