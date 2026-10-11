import { beforeEach, describe, expect, test } from 'bun:test';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

const T0 = Date.UTC(2026, 0, 1);
const at = (n) => Timestamp.fromMillis(T0 + n * 60_000);

async function seed(id, { type = 'direct', userIds, lastMessageAt, name = null }) {
  const sorted = [...userIds].sort();
  const participants = {};
  const unread = {};
  for (const u of sorted) {
    participants[u] = { full_name: u.toUpperCase(), avatar_url: null };
    unread[u] = 0;
  }
  await setDoc(doc(db, 'chats', id), {
    type,
    user_ids: sorted,
    participants,
    name: type === 'group' ? name ?? id : null,
    avatar_url: null,
    created_by: type === 'group' ? sorted[0] : null,
    admin_ids: type === 'group' ? [sorted[0]] : [],
    last_message: null,
    last_message_at: lastMessageAt,
    unread_counts: unread,
    created_at: at(0),
    updated_at: at(0),
  });
}

async function list(...args) {
  const service = await loadChatService();
  return service.listUserChats(...args);
}

/** Seeds `count` chats for u1 with ascending timestamps; id c{i} has timestamp i. */
async function seedMany(count) {
  for (let i = 1; i <= count; i++) {
    await seed(`c${i}`, { userIds: ['u1', `peer${i}`], lastMessageAt: at(i) });
  }
}

async function walk(pageSize) {
  const ids = [];
  const pages = [];
  let cursor = null;
  for (let guard = 0; guard < 50; guard++) {
    const page = await list('u1', pageSize, cursor);
    pages.push(page);
    ids.push(...page.items.map((c) => c.id));
    if (!page.hasMore) break;
    cursor = page.cursor;
  }
  return { ids, pages };
}

describe('listUserChats', () => {
  // AC#13: direct and group chats containing the user; others excluded
  test('returns direct and group chats containing the user, excluding others', async () => {
    await seed('u1_u2', { userIds: ['u1', 'u2'], lastMessageAt: at(1) });
    await seed('g1', { type: 'group', userIds: ['u1', 'u2', 'u3', 'u4'], lastMessageAt: at(2) });
    await seed('u2_u3', { userIds: ['u2', 'u3'], lastMessageAt: at(3) });
    await seed('g2', { type: 'group', userIds: ['u2', 'u3', 'u4'], lastMessageAt: at(4) });

    const page = await list('u1');
    expect(page.items.map((c) => c.id)).toEqual(['g1', 'u1_u2']);
    expect(page.items.map((c) => c.type)).toEqual(['group', 'direct']);
    expect(page.hasMore).toBe(false);
  });

  // AC#13: user with no chats
  test('user with no chats gets an empty page', async () => {
    await seed('u2_u3', { userIds: ['u2', 'u3'], lastMessageAt: at(1) });
    const page = await list('u1');
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.cursor ?? null).toBeNull();
  });

  // AC#13: newest activity first
  test('orders by last_message_at descending regardless of creation order', async () => {
    await seed('a', { userIds: ['u1', 'x'], lastMessageAt: at(5) });
    await seed('b', { userIds: ['u1', 'y'], lastMessageAt: at(50) });
    await seed('c', { userIds: ['u1', 'z'], lastMessageAt: at(20) });
    const page = await list('u1');
    expect(page.items.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  // Spec §3.1 Chat shape
  test('items are camelCase Chat objects with Date instances', async () => {
    await seed('g1', { type: 'group', userIds: ['u1', 'u2', 'u3'], lastMessageAt: at(7), name: 'Study' });
    const [chat] = (await list('u1')).items;
    expect(chat.id).toBe('g1');
    expect(chat.type).toBe('group');
    expect(chat.name).toBe('Study');
    expect(chat.userIds).toEqual(['u1', 'u2', 'u3']);
    expect(chat.participants.u2).toEqual({ fullName: 'U2', avatarUrl: null });
    expect(chat.unreadCounts).toEqual({ u1: 0, u2: 0, u3: 0 });
    expect(chat.lastMessageAt).toBeInstanceOf(Date);
    expect(chat.lastMessageAt.getTime()).toBe(at(7).toMillis());
    expect(chat.createdAt).toBeInstanceOf(Date);
    expect(chat.updatedAt).toBeInstanceOf(Date);
  });

  // AC#13: default page size 20
  test('default page size is 20', async () => {
    await seedMany(25);
    const page = await list('u1');
    expect(page.items).toHaveLength(20);
    expect(page.hasMore).toBe(true);
    expect(page.items[0].id).toBe('c25');
    expect(page.items[19].id).toBe('c6');
  });

  // AC#13: pagination hasMore + cursor, no overlap/gaps, full order
  test('walking pages with the cursor reproduces the full newest-first order', async () => {
    await seedMany(7);
    const { ids, pages } = await walk(3);
    expect(ids).toEqual(['c7', 'c6', 'c5', 'c4', 'c3', 'c2', 'c1']);
    expect(pages.map((p) => p.items.length)).toEqual([3, 3, 1]);
    expect(pages.map((p) => p.hasMore)).toEqual([true, true, false]);
    expect(new Set(ids).size).toBe(7);
  });

  test('first page returns a non-null cursor when more remain', async () => {
    await seedMany(5);
    const page = await list('u1', 2);
    expect(page.items.map((c) => c.id)).toEqual(['c5', 'c4']);
    expect(page.hasMore).toBe(true);
    expect(page.cursor).not.toBeNull();
    expect(page.cursor).not.toBeUndefined();
  });

  test('exactly pageSize chats yields one page with hasMore false', async () => {
    await seedMany(4);
    const page = await list('u1', 4);
    expect(page.items).toHaveLength(4);
    expect(page.hasMore).toBe(false);
  });

  test('fewer chats than pageSize yields all with hasMore false', async () => {
    await seedMany(2);
    const page = await list('u1', 10);
    expect(page.items.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(page.hasMore).toBe(false);
  });

  test('pagination excludes other users chats interleaved in time', async () => {
    await seed('m1', { userIds: ['u1', 'a'], lastMessageAt: at(1) });
    await seed('o1', { userIds: ['b', 'c'], lastMessageAt: at(2) });
    await seed('m2', { type: 'group', userIds: ['u1', 'b', 'c'], lastMessageAt: at(3) });
    await seed('o2', { userIds: ['b', 'c2'], lastMessageAt: at(4) });
    await seed('m3', { userIds: ['u1', 'd'], lastMessageAt: at(5) });
    const { ids } = await walk(1);
    expect(ids).toEqual(['m3', 'm2', 'm1']);
  });

  test('cursor of an empty page after the last page is null or the passed cursor', async () => {
    await seedMany(2);
    const first = await list('u1', 2);
    expect(first.hasMore).toBe(false);
    const next = await list('u1', 2, first.cursor);
    expect(next.items).toEqual([]);
    expect(next.hasMore).toBe(false);
    expect([null, first.cursor]).toContainEqual(next.cursor);
  });

  // AC#13: ties do not lose or duplicate chats
  test('chats with equal last_message_at each appear exactly once across pages', async () => {
    await seed('t1', { userIds: ['u1', 'a'], lastMessageAt: at(10) });
    await seed('t2', { userIds: ['u1', 'b'], lastMessageAt: at(10) });
    await seed('t3', { type: 'group', userIds: ['u1', 'c', 'd'], lastMessageAt: at(10) });
    await seed('new', { userIds: ['u1', 'e'], lastMessageAt: at(20) });
    await seed('old', { userIds: ['u1', 'f'], lastMessageAt: at(1) });

    for (const size of [1, 2, 3]) {
      const { ids } = await walk(size);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
      expect(ids[0]).toBe('new');
      expect(ids[4]).toBe('old');
      expect(new Set(ids.slice(1, 4))).toEqual(new Set(['t1', 't2', 't3']));
    }
  });
});
