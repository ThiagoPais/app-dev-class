import { beforeEach, describe, expect, test } from 'bun:test';
import { collection, doc, getDoc, getDocsFromServer, setDoc, Timestamp } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

const T0 = Date.UTC(2026, 0, 1);
const at = (n) => Timestamp.fromMillis(T0 + n * 60_000);

const AUTHOR = { full_name: 'Alice', avatar_url: null };

/** Seeds a raw (snake_case) text message at chats/{chatId}/chat_messages/{id}. */
function seedText(chatId, id, n, extra = {}) {
  return setDoc(doc(db, 'chats', chatId, 'chat_messages', id), {
    chat_id: chatId,
    type: 'text',
    author_id: 'u1',
    author_snapshot: AUTHOR,
    message: `text ${id}`,
    system_event: null,
    is_deleted: false,
    created_at: at(n),
    updated_at: at(n),
    ...extra,
  });
}

function seedSystem(chatId, id, n, systemEvent) {
  return setDoc(doc(db, 'chats', chatId, 'chat_messages', id), {
    chat_id: chatId,
    type: 'system',
    author_id: null,
    author_snapshot: null,
    message: null,
    system_event: systemEvent,
    is_deleted: false,
    created_at: at(n),
    updated_at: at(n),
  });
}

/** Chat with `count` text messages m1..m{count}; message m{i} has timestamp i. */
async function seedMany(chatId, count) {
  await Promise.all(Array.from({ length: count }, (_, i) => seedText(chatId, `m${i + 1}`, i + 1)));
}

async function getService() {
  const service = await loadChatService();
  expect(typeof service.listChatMessages).toBe('function');
  return service;
}

async function list(...args) {
  const service = await getService();
  return service.listChatMessages(...args);
}

async function walk(chatId, pageSize) {
  const ids = [];
  const pages = [];
  let cursor = null;
  for (let guard = 0; guard < 200; guard++) {
    const page = await list(chatId, pageSize, cursor);
    pages.push(page);
    ids.push(...page.items.map((m) => m.id));
    if (!page.hasMore) break;
    cursor = page.cursor;
  }
  return { ids, pages };
}

describe('listChatMessages', () => {
  test('is exported as a function', async () => {
    await getService();
  });

  // Spec 3.2 / AC#14: newest first (created_at DESC)
  test('orders by created_at descending regardless of write order', async () => {
    await seedText('c1', 'a', 5);
    await seedText('c1', 'b', 50);
    await seedText('c1', 'c', 20);
    const page = await list('c1');
    expect(page.items.map((m) => m.id)).toEqual(['b', 'c', 'a']);
    expect(page.hasMore).toBe(false);
  });

  // Spec 3.2: only the requested chat's messages
  test('never returns messages of other chats', async () => {
    await seedText('c1', 'a1', 1);
    await seedText('c2', 'b1', 2);
    await seedText('c1', 'a2', 3);
    await seedText('c2', 'b2', 4);
    const page = await list('c1');
    expect(page.items.map((m) => m.id)).toEqual(['a2', 'a1']);
    expect(page.items.every((m) => m.chatId === 'c1')).toBe(true);
    const other = await list('c2');
    expect(other.items.map((m) => m.id)).toEqual(['b2', 'b1']);
  });

  // Spec 3.1 ChatMessage shape (text)
  test('text items are camelCase ChatMessage objects with Date instances', async () => {
    await seedText('c1', 'a', 7);
    const [msg] = (await list('c1')).items;
    expect(msg.id).toBe('a');
    expect(msg.chatId).toBe('c1');
    expect(msg.type).toBe('text');
    expect(msg.authorId).toBe('u1');
    expect(msg.authorSnapshot).toEqual({ fullName: 'Alice', avatarUrl: null });
    expect(msg.message).toBe('text a');
    expect(msg.systemEvent).toBeNull();
    expect(msg.isDeleted).toBe(false);
    expect(msg.createdAt).toBeInstanceOf(Date);
    expect(msg.createdAt.getTime()).toBe(at(7).toMillis());
    expect(msg.updatedAt).toBeInstanceOf(Date);
    expect(msg.updatedAt.getTime()).toBe(at(7).toMillis());
  });

  // Contract: soft-deleted messages are included, not filtered
  test('includes soft-deleted messages with isDeleted true in timestamp order', async () => {
    await seedText('c1', 'a', 1);
    await seedText('c1', 'del', 2, { is_deleted: true });
    await seedText('c1', 'b', 3);
    const page = await list('c1');
    expect(page.items.map((m) => m.id)).toEqual(['b', 'del', 'a']);
    expect(page.items.map((m) => m.isDeleted)).toEqual([false, true, false]);
  });

  // Contract: system messages included with mapped systemEvent
  test('includes system messages with mapped systemEvent in timestamp order', async () => {
    await seedSystem('g1', 'sys1', 1, { kind: 'group_created', actor_id: 'u1', target_ids: [] });
    await seedText('g1', 'a', 2);
    await seedSystem('g1', 'sys2', 3, { kind: 'member_added', actor_id: 'u1', target_ids: ['u2', 'u3'] });
    const page = await list('g1');
    expect(page.items.map((m) => m.id)).toEqual(['sys2', 'a', 'sys1']);

    const sys = page.items[0];
    expect(sys.type).toBe('system');
    expect(sys.chatId).toBe('g1');
    expect(sys.authorId).toBeNull();
    expect(sys.authorSnapshot).toBeNull();
    expect(sys.message).toBeNull();
    expect(sys.systemEvent).toEqual({ kind: 'member_added', actorId: 'u1', targetIds: ['u2', 'u3'] });
    expect(sys.isDeleted).toBe(false);
    expect(sys.createdAt).toBeInstanceOf(Date);
    expect(sys.updatedAt).toBeInstanceOf(Date);

    expect(page.items[2].systemEvent).toEqual({ kind: 'group_created', actorId: 'u1', targetIds: [] });
  });

  // Empty cases
  test('chat with no messages (parent doc absent) gives an empty page', async () => {
    const page = await list('ghost');
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.cursor ?? null).toBeNull();
  });

  test('chat whose only messages belong to another chat gives an empty page', async () => {
    await seedText('c2', 'b1', 1);
    const page = await list('c1');
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  // AC#14: pagination
  test('walking pages with the cursor reproduces the full newest-first order', async () => {
    await seedMany('c1', 7);
    const { ids, pages } = await walk('c1', 3);
    expect(ids).toEqual(['m7', 'm6', 'm5', 'm4', 'm3', 'm2', 'm1']);
    expect(pages.map((p) => p.items.length)).toEqual([3, 3, 1]);
    expect(pages.map((p) => p.hasMore)).toEqual([true, true, false]);
    expect(new Set(ids).size).toBe(7);
  });

  test('first page returns a non-null cursor when more remain', async () => {
    await seedMany('c1', 5);
    const page = await list('c1', 2);
    expect(page.items.map((m) => m.id)).toEqual(['m5', 'm4']);
    expect(page.hasMore).toBe(true);
    expect(page.cursor).not.toBeNull();
    expect(page.cursor).not.toBeUndefined();
  });

  test('passing the cursor returns the following page without overlap', async () => {
    await seedMany('c1', 5);
    const first = await list('c1', 2);
    const second = await list('c1', 2, first.cursor);
    expect(second.items.map((m) => m.id)).toEqual(['m3', 'm2']);
    expect(second.hasMore).toBe(true);
  });

  test('exactly pageSize messages yields one page with hasMore false', async () => {
    await seedMany('c1', 4);
    const page = await list('c1', 4);
    expect(page.items).toHaveLength(4);
    expect(page.hasMore).toBe(false);
  });

  test('fewer messages than pageSize yields all with hasMore false', async () => {
    await seedMany('c1', 2);
    const page = await list('c1', 10);
    expect(page.items.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(page.hasMore).toBe(false);
  });

  test('pagination excludes other chats messages interleaved in time', async () => {
    await seedText('c1', 'a1', 1);
    await seedText('c2', 'b1', 2);
    await seedText('c1', 'a2', 3);
    await seedText('c2', 'b2', 4);
    await seedText('c1', 'a3', 5);
    const { ids } = await walk('c1', 1);
    expect(ids).toEqual(['a3', 'a2', 'a1']);
  });

  test('pagination keeps soft-deleted and system messages in order', async () => {
    await seedSystem('g1', 'sys1', 1, { kind: 'group_created', actor_id: 'u1', target_ids: [] });
    await seedText('g1', 'a', 2);
    await seedText('g1', 'del', 3, { is_deleted: true });
    await seedSystem('g1', 'sys2', 4, { kind: 'member_left', actor_id: 'u2', target_ids: ['u2'] });
    await seedText('g1', 'b', 5);
    const { ids } = await walk('g1', 2);
    expect(ids).toEqual(['b', 'sys2', 'del', 'a', 'sys1']);
  });

  test('cursor of an empty page after the last page is null or the passed cursor', async () => {
    await seedMany('c1', 2);
    const first = await list('c1', 2);
    expect(first.hasMore).toBe(false);
    const next = await list('c1', 2, first.cursor);
    expect(next.items).toEqual([]);
    expect(next.hasMore).toBe(false);
    expect([null, first.cursor]).toContainEqual(next.cursor);
  });

  // Ties
  test('messages with equal created_at each appear exactly once across pages', async () => {
    await seedText('c1', 't1', 10);
    await seedText('c1', 't2', 10);
    await seedText('c1', 't3', 10);
    await seedText('c1', 'new', 20);
    await seedText('c1', 'old', 1);

    for (const size of [1, 2, 3]) {
      const { ids } = await walk('c1', size);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
      expect(ids[0]).toBe('new');
      expect(ids[4]).toBe('old');
      expect(new Set(ids.slice(1, 4))).toEqual(new Set(['t1', 't2', 't3']));
    }
  });

  // Default page size 50 (DEFAULT_MESSAGE_PAGE_SIZE)
  test('default page size is 50 across 120 messages (50/50/20)', async () => {
    await seedMany('big', 120);
    await seedMany('other', 5);

    const p1 = await list('big');
    expect(p1.items).toHaveLength(50);
    expect(p1.hasMore).toBe(true);
    expect(p1.items[0].id).toBe('m120');
    expect(p1.items[49].id).toBe('m71');

    const p2 = await list('big', undefined, p1.cursor);
    expect(p2.items).toHaveLength(50);
    expect(p2.hasMore).toBe(true);
    expect(p2.items[0].id).toBe('m70');
    expect(p2.items[49].id).toBe('m21');

    const p3 = await list('big', undefined, p2.cursor);
    expect(p3.items).toHaveLength(20);
    expect(p3.hasMore).toBe(false);
    expect(p3.items[0].id).toBe('m20');
    expect(p3.items[19].id).toBe('m1');

    const all = [...p1.items, ...p2.items, ...p3.items].map((m) => m.id);
    expect(new Set(all).size).toBe(120);
  });

  // No side effects
  test('does not create or modify any document', async () => {
    await seedText('c1', 'a', 1);
    await seedSystem('c1', 'sys', 2, { kind: 'group_created', actor_id: 'u1', target_ids: [] });
    const snapshot = async () => {
      const snap = await getDocsFromServer(collection(db, 'chats', 'c1', 'chat_messages'));
      return snap.docs.map((d) => [d.id, d.data()]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    };
    const before = await snapshot();
    await list('c1', 1);
    await list('ghost');
    const after = await snapshot();
    expect(after).toEqual(before);
    expect((await getDoc(doc(db, 'chats', 'c1'))).exists()).toBe(false);
    expect((await getDoc(doc(db, 'chats', 'ghost'))).exists()).toBe(false);
    const ghostMsgs = await getDocsFromServer(collection(db, 'chats', 'ghost', 'chat_messages'));
    expect(ghostMsgs.empty).toBe(true);
  });
});
