import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

let counter = 0;
const nextId = (p = 'succ') => `${p}-${Date.now()}-${++counter}`;

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

async function raw(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.exists() ? snap.data() : null;
}

async function messages(chatId) {
  const snap = await getDocs(collection(db, 'chats', chatId, 'chat_messages'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const ofKind = (msgs, kind) => msgs.filter((m) => m.system_event?.kind === kind);

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

async function service() {
  const s = await loadChatService();
  expect(typeof s.leaveGroupChat).toBe('function');
  expect(typeof s.removeGroupMember).toBe('function');
  return s;
}

async function leave(chatId, userId) {
  return (await service()).leaveGroupChat(chatId, userId);
}

async function remove(chatId, actorId, targetId) {
  return (await service()).removeGroupMember(chatId, actorId, targetId);
}

// Shared assertions for a successful promotion after `leaverId` left.
async function expectPromoted(id, data, leaverId, promotedId, expectedUserIds) {
  const s = await raw(id);
  expect(s).not.toBeNull();
  expect(s.user_ids).toEqual(expectedUserIds);
  expect(s.admin_ids).toEqual([promotedId]);
  expect(s.created_by).toBe(data.created_by);
  expect(s.last_message).toEqual(data.last_message);
  expect(s.last_message_at.isEqual(data.last_message_at)).toBe(true);
  expect(s.updated_at.toMillis()).toBeGreaterThan(data.updated_at.toMillis());
  const expectedP = {};
  const expectedU = {};
  for (const u of expectedUserIds) {
    expectedP[u] = data.participants[u];
    expectedU[u] = data.unread_counts[u];
  }
  expect(s.participants).toEqual(expectedP);
  expect(s.unread_counts).toEqual(expectedU);
  expect(leaverId in s.participants).toBe(false);
  expect(leaverId in s.unread_counts).toBe(false);

  const msgs = await messages(id);
  expect(msgs).toHaveLength(2);
  const left = ofKind(msgs, 'member_left');
  const promoted = ofKind(msgs, 'admin_promoted');
  expect(left).toHaveLength(1);
  expect(promoted).toHaveLength(1);
  expectSystemMessage(left[0], id, 'member_left', leaverId, leaverId);
  expectSystemMessage(promoted[0], id, 'admin_promoted', leaverId, promotedId);
}

async function expectNoPromotion(id, expectedAdmins) {
  expect((await raw(id)).admin_ids).toEqual(expectedAdmins);
  const msgs = await messages(id);
  expect(msgs).toHaveLength(1);
  expect(ofKind(msgs, 'admin_promoted')).toHaveLength(0);
}

describe('admin succession on leaveGroupChat (AC#8, rule 6)', () => {
  test('sole admin leaves a group of 3: oldest by join order (not alphabetical) is promoted', async () => {
    const { id, data } = await seedGroup({ userIds: ['zed', 'mia', 'amy'], adminIds: ['zed'] });
    await leave(id, 'zed');
    await expectPromoted(id, data, 'zed', 'mia', ['mia', 'amy']);
  });

  test('sole admin leaves a 2-member group: the other member is promoted', async () => {
    const { id, data } = await seedGroup({ userIds: ['a', 'b'], adminIds: ['a'] });
    await leave(id, 'a');
    await expectPromoted(id, data, 'a', 'b', ['b']);
  });

  test('creator (first, sole admin) leaves: next in join order is promoted, created_by unchanged', async () => {
    const { id, data } = await seedGroup({
      userIds: ['creator', 'second', 'third', 'fourth'],
      adminIds: ['creator'],
      createdBy: 'creator',
    });
    await leave(id, 'creator');
    await expectPromoted(id, data, 'creator', 'second', ['second', 'third', 'fourth']);
    expect((await raw(id)).created_by).toBe('creator');
  });

  test('sole admin in the middle of join order leaves: first remaining member is promoted', async () => {
    const { id, data } = await seedGroup({ userIds: ['p1', 'p2', 'adm', 'p3'], adminIds: ['adm'], createdBy: 'p1' });
    await leave(id, 'adm');
    await expectPromoted(id, data, 'adm', 'p1', ['p1', 'p2', 'p3']);
  });

  test('stale admin uid not in user_ids is ignored and dropped; user_ids[0] of remaining is promoted', async () => {
    const { id, data } = await seedGroup({ userIds: ['zed', 'mia', 'amy'], adminIds: ['ghost', 'zed'] });
    await leave(id, 'zed');
    await expectPromoted(id, data, 'zed', 'mia', ['mia', 'amy']);
    expect((await raw(id)).admin_ids).not.toContain('ghost');
  });
});

describe('no promotion cases (AC#8 negatives)', () => {
  test('two admins, one leaves: other stays admin, one message', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b'] });
    await leave(id, 'a');
    await expectNoPromotion(id, ['b']);
  });

  test('three admins, middle leaves: remaining admins keep original order, one message', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c', 'd'], adminIds: ['a', 'b', 'c'] });
    await leave(id, 'b');
    await expectNoPromotion(id, ['a', 'c']);
  });

  test('plain member leaves while admin_ids is the sole admin: no promotion', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await leave(id, 'c');
    await expectNoPromotion(id, ['a']);
    expect((await raw(id)).user_ids).toEqual(['a', 'b']);
  });

  test('last member (sole admin) leaves: empty group, admin_ids [], no admin_promoted', async () => {
    const { id } = await seedGroup({ userIds: ['solo'], adminIds: ['solo'] });
    await leave(id, 'solo');
    const s = await raw(id);
    expect(s).not.toBeNull();
    expect(s.user_ids).toEqual([]);
    expect(s.admin_ids).toEqual([]);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expect(ofKind(msgs, 'member_left')).toHaveLength(1);
    expect(ofKind(msgs, 'admin_promoted')).toHaveLength(0);
  });
});

describe('removeGroupMember (AC#8, no promotion expected)', () => {
  test('admin removes another admin: actor stays admin, no promotion, exactly one message', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a', 'b'] });
    await remove(id, 'a', 'b');
    const s = await raw(id);
    expect(s.user_ids).toEqual(['a', 'c']);
    expect(s.admin_ids).toEqual(['a']);
    const msgs = await messages(id);
    expect(msgs).toHaveLength(1);
    expect(ofKind(msgs, 'admin_promoted')).toHaveLength(0);
    expect(ofKind(msgs, 'member_removed')).toHaveLength(1);
  });

  test('admin removes a plain member while sole admin: no promotion, one message', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    await remove(id, 'a', 'b');
    await expectNoPromotion(id, ['a']);
  });
});

describe('admin succession concurrency', () => {
  test('a (sole admin) and b leave concurrently: c ends as sole member and admin', async () => {
    const { id } = await seedGroup({ userIds: ['a', 'b', 'c'], adminIds: ['a'] });
    const s = await service();
    await Promise.all([s.leaveGroupChat(id, 'a'), s.leaveGroupChat(id, 'b')]);
    const stored = await raw(id);
    expect(stored.user_ids).toEqual(['c']);
    expect(stored.admin_ids).toEqual(['c']);
    const msgs = await messages(id);
    expect(ofKind(msgs, 'member_left')).toHaveLength(2);
    const promotions = ofKind(msgs, 'admin_promoted').length;
    expect(promotions === 1 || promotions === 2).toBe(true);
  });
});
