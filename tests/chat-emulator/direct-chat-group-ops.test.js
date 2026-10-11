import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

// Consolidated regression: every group-only operation rejects direct chats with CHAT_NOT_GROUP
// (spec 5 Group chats AC6, spec 3.2 behavior notes) and writes nothing.

beforeEach(clearDatabase);

let counter = 0;
const nextId = (p = 'dcg') => `${p}-${Date.now()}-${++counter}`;

const SEED_MS = 1_700_000_000_000;
const ts = (offset = 0) => Timestamp.fromMillis(SEED_MS + offset);
const wire = (n) => ({ full_name: `User ${n}`, avatar_url: null });
const member = (userId) => ({ userId, profile: { fullName: userId.toUpperCase(), avatarUrl: null } });

// [name, call(service, chatId, actorId)]
const OPERATIONS = [
  ['addGroupMembers', (s, chatId, actorId) => s.addGroupMembers({ chatId, actorId, members: [member('newbie')] })],
  ['removeGroupMember', (s, chatId, actorId) => s.removeGroupMember(chatId, actorId, 'b')],
  ['leaveGroupChat', (s, chatId, actorId) => s.leaveGroupChat(chatId, actorId)],
  ['setGroupAdmin(true)', (s, chatId, actorId) => s.setGroupAdmin(chatId, actorId, 'b', true)],
  ['setGroupAdmin(false)', (s, chatId, actorId) => s.setGroupAdmin(chatId, actorId, 'a', false)],
  ['updateGroupInfo(name)', (s, chatId, actorId) => s.updateGroupInfo({ chatId, actorId, name: 'New name' })],
  ['updateGroupInfo(avatar only)', (s, chatId, actorId) => s.updateGroupInfo({ chatId, actorId, avatarUrl: 'http://x/new.png' })],
];

const CALLERS = [
  ['participant user_ids[0]', 'a'],
  ['participant user_ids[1]', 'b'],
  ['outsider', 'outsider'],
];

async function seedDirect(overrides = {}) {
  const id = nextId('dm');
  const data = {
    type: 'direct',
    user_ids: ['a', 'b'],
    name: null,
    avatar_url: null,
    created_by: null,
    admin_ids: [],
    participants: { a: wire(1), b: wire(2) },
    unread_counts: { a: 3, b: 5 },
    last_message: { text: 'hi', author_id: 'b', type: 'text', created_at: ts(500) },
    last_message_at: ts(500),
    created_at: ts(0),
    updated_at: ts(1000),
    ...overrides,
  };
  await setDoc(doc(db, 'chats', id), data);
  return { id, data };
}

async function seedGroup() {
  const id = nextId('grp');
  const data = {
    type: 'group',
    user_ids: ['adm', 'm1', 'm2'],
    name: 'Study group',
    avatar_url: 'http://x/g.png',
    created_by: 'adm',
    admin_ids: ['adm'],
    participants: { adm: wire(10), m1: wire(11), m2: wire(12) },
    unread_counts: { adm: 0, m1: 0, m2: 0 },
    last_message: { text: 'hello', author_id: 'm2', type: 'text', created_at: ts(500) },
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
  for (const fn of ['addGroupMembers', 'removeGroupMember', 'leaveGroupChat', 'setGroupAdmin', 'updateGroupInfo']) {
    expect(typeof s[fn]).toBe('function');
  }
  return s;
}

// Never use expect(promise).rejects on Firestore promises under bun (deadlock).
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

async function expectAllRejectedAsNotGroup(id, data) {
  const s = await service();
  for (const [name, call] of OPERATIONS) {
    for (const [who, actorId] of CALLERS) {
      const err = await rejection(call(s, id, actorId));
      expect(err, `${name} as ${who}`).toBeInstanceOf(Error);
      expect(err.code, `${name} as ${who}`).toBe('CHAT_NOT_GROUP');
      await expectUntouched(id, data);
    }
  }
}

describe('group-only operations on a direct chat -> CHAT_NOT_GROUP, nothing written (AC#9)', () => {
  describe('(a) raw seeded direct chat', () => {
    for (const [name, call] of OPERATIONS) {
      for (const [who, actorId] of CALLERS) {
        test(`${name} as ${who}`, async () => {
          const { id, data } = await seedDirect();
          const s = await service();
          await expectRejects(call(s, id, actorId), 'CHAT_NOT_GROUP');
          await expectUntouched(id, data);
        });
      }
    }
  });

  describe('(b) direct chat created through getOrCreateDirectChat', () => {
    for (const [name, call] of OPERATIONS) {
      for (const [who, actorId] of CALLERS) {
        test(`${name} as ${who}`, async () => {
          const s = await service();
          await s.getOrCreateDirectChat({
            currentUser: { userId: 'b', profile: { fullName: 'B', avatarUrl: null } },
            otherUser: { userId: 'a', profile: { fullName: 'A', avatarUrl: null } },
          });
          const id = 'a_b';
          const before = await raw(id);
          expect(before.type).toBe('direct');
          await expectRejects(call(s, id, actorId), 'CHAT_NOT_GROUP');
          await expectUntouched(id, before);
        });
      }
    }
  });

  describe('(c) direct chat with corrupted admin_ids containing a participant', () => {
    for (const [name, call] of OPERATIONS) {
      for (const [who, actorId] of CALLERS) {
        test(`${name} as ${who}`, async () => {
          const { id, data } = await seedDirect({ admin_ids: ['a'] });
          const s = await service();
          await expectRejects(call(s, id, actorId), 'CHAT_NOT_GROUP');
          await expectUntouched(id, data);
        });
      }
    }

    test('all operations and callers in sequence leave the chat identical', async () => {
      const { id, data } = await seedDirect({ admin_ids: ['a'] });
      await expectAllRejectedAsNotGroup(id, data);
    });
  });

  test('missing chat still gives CHAT_NOT_FOUND', async () => {
    const id = nextId('missing');
    const s = await service();
    await expectRejects(s.leaveGroupChat(id, 'a'), 'CHAT_NOT_FOUND');
    expect(await raw(id)).toBeNull();
    expect(await messages(id)).toHaveLength(0);
  });
});

describe('controls: the same calls are not rejected with CHAT_NOT_GROUP on a real group', () => {
  test('addGroupMembers by an admin', async () => {
    const { id } = await seedGroup();
    const s = await service();
    expect(await rejection(s.addGroupMembers({ chatId: id, actorId: 'adm', members: [member('newbie')] }))).toBeNull();
    expect((await raw(id)).user_ids).toContain('newbie');
  });

  test('removeGroupMember by an admin', async () => {
    const { id } = await seedGroup();
    const s = await service();
    expect(await rejection(s.removeGroupMember(id, 'adm', 'm1'))).toBeNull();
    expect((await raw(id)).user_ids).not.toContain('m1');
  });

  test('leaveGroupChat by a different (non-admin) member', async () => {
    const { id } = await seedGroup();
    const s = await service();
    expect(await rejection(s.leaveGroupChat(id, 'm2'))).toBeNull();
    expect((await raw(id)).user_ids).not.toContain('m2');
  });

  test('setGroupAdmin promote by an admin', async () => {
    const { id } = await seedGroup();
    const s = await service();
    expect(await rejection(s.setGroupAdmin(id, 'adm', 'm1', true))).toBeNull();
    expect((await raw(id)).admin_ids).toEqual(['adm', 'm1']);
  });

  test('updateGroupInfo rename by an admin', async () => {
    const { id } = await seedGroup();
    const s = await service();
    expect(await rejection(s.updateGroupInfo({ chatId: id, actorId: 'adm', name: 'Renamed' }))).toBeNull();
    expect((await raw(id)).name).toBe('Renamed');
  });
});
