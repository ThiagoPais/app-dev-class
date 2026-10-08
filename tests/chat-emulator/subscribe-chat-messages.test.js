import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

const T = 8000; // per-test timeout (ms)
const unsubs = [];

afterEach(() => {
  while (unsubs.length) {
    try {
      unsubs.pop()();
    } catch {
      // ignore
    }
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(predicate, timeoutMs = 2500, message = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await sleep(25);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms waiting for: ${message}`);
}

// Every test gets its own chat id (harness does not reconcile subcollection cache).
let counter = 0;
const newChatId = () => `c${++counter}_${Math.random().toString(36).slice(2, 8)}`;

async function subscribe(chatId, { withOnError = true, pageSize } = {}) {
  const service = await loadChatService();
  expect(typeof service.subscribeToChatMessages).toBe('function');
  const emissions = [];
  const onChange = (messages) => emissions.push(messages);
  const args = [chatId, onChange];
  if (withOnError) args.push(() => {});
  else if (pageSize !== undefined) args.push(undefined);
  if (pageSize !== undefined) args.push(pageSize);
  const unsubscribe = service.subscribeToChatMessages(...args);
  expect(typeof unsubscribe).toBe('function');
  unsubs.push(unsubscribe);
  return { emissions, unsubscribe, last: () => emissions[emissions.length - 1] };
}

const rawMsg = (ms, extra = {}) => ({
  chat_id: 'ignored',
  type: 'text',
  author_id: 'alice',
  author_snapshot: { full_name: 'Alice', avatar_url: null },
  message: `m${ms}`,
  system_event: null,
  is_deleted: false,
  created_at: Timestamp.fromMillis(ms),
  updated_at: Timestamp.fromMillis(ms),
  ...extra,
});

const ref = (chatId, id) => doc(db, 'chats', chatId, 'chat_messages', id);
const put = (chatId, id, ms, extra) => setDoc(ref(chatId, id), rawMsg(ms, { chat_id: chatId, ...extra }));
const ids = (msgs) => msgs.map((m) => m.id);

describe('subscribeToChatMessages', () => {
  // Spec §3.2: returns the unsubscribe function
  test('returns a function synchronously', async () => {
    const service = await loadChatService();
    expect(typeof service.subscribeToChatMessages).toBe('function');
    const unsubscribe = service.subscribeToChatMessages(newChatId(), () => {});
    unsubs.push(unsubscribe);
    expect(typeof unsubscribe).toBe('function');
  }, T);

  // Contract: initial emission, [] when none
  test('emits [] initially when the chat has no messages', async () => {
    const s = await subscribe(newChatId());
    await waitFor(() => s.emissions.length >= 1, 3000, 'initial emission');
    expect(s.emissions[0]).toEqual([]);
  }, T);

  // Spec §3.2 onSnapshot on newest page, §3.1 ChatMessage shape
  test('initial emission: newest first, camelCase, Dates, chatId set', async () => {
    const c = newChatId();
    await put(c, 'm1', 1_000_000);
    await put(c, 'm3', 3_000_000);
    await put(c, 'm2', 2_000_000);
    const s = await subscribe(c);
    await waitFor(() => s.emissions.some((e) => e.length === 3), 3000, 'three messages');
    const list = s.last();
    expect(ids(list)).toEqual(['m3', 'm2', 'm1']);
    expect(list[0].chatId).toBe(c);
    expect(list[0].authorId).toBe('alice');
    expect(list[0].message).toBe('m3000000');
    expect(list[0].isDeleted).toBe(false);
    expect(list[0].createdAt).toBeInstanceOf(Date);
    expect(list[0].createdAt.getTime()).toBe(3_000_000);
    expect(list[0].updatedAt).toBeInstanceOf(Date);
  }, T);

  // Spec §5 Messages AC5 (AC#15): emit on remote changes - new message
  test('emits again when a new message appears (at the front)', async () => {
    const c = newChatId();
    await put(c, 'm1', 1_000_000);
    const s = await subscribe(c);
    await waitFor(() => s.last()?.length === 1, 3000, 'initial message');
    await put(c, 'm2', 2_000_000);
    await waitFor(() => s.last().length === 2, 3000, 'new message emitted');
    expect(ids(s.last())).toEqual(['m2', 'm1']);
  }, T);

  // Contract: system messages included, no filtering
  test('system messages are included', async () => {
    const c = newChatId();
    const s = await subscribe(c);
    await waitFor(() => s.emissions.length >= 1, 3000, 'initial emission');
    await put(c, 'sys1', 1_000_000, {
      type: 'system',
      author_id: null,
      author_snapshot: null,
      message: null,
      system_event: { kind: 'group_created', actor_id: 'alice', target_ids: [] },
    });
    await waitFor(() => s.last().length === 1, 3000, 'system message emitted');
    expect(s.last()[0].id).toBe('sys1');
    expect(s.last()[0].type).toBe('system');
    expect(s.last()[0].systemEvent?.kind).toBe('group_created');
  }, T);

  // Spec §5 AC5: edit emits
  test('emits when a message is edited', async () => {
    const c = newChatId();
    await put(c, 'm1', 1_000_000);
    const s = await subscribe(c);
    await waitFor(() => s.last()?.length === 1, 3000, 'initial message');
    await updateDoc(ref(c, 'm1'), { message: 'edited', updated_at: Timestamp.fromMillis(9_000_000) });
    await waitFor(() => s.last()[0]?.message === 'edited', 3000, 'edit emitted');
    expect(s.last()[0].updatedAt.getTime()).toBe(9_000_000);
    expect(s.last()).toHaveLength(1);
  }, T);

  // Contract: soft-deleted still in the list
  test('soft-deleted message stays in the list with isDeleted true', async () => {
    const c = newChatId();
    await put(c, 'm1', 1_000_000);
    await put(c, 'm2', 2_000_000);
    const s = await subscribe(c);
    await waitFor(() => s.last()?.length === 2, 3000, 'initial messages');
    await updateDoc(ref(c, 'm1'), { is_deleted: true });
    await waitFor(() => s.last().find((m) => m.id === 'm1')?.isDeleted === true, 3000, 'soft delete');
    expect(ids(s.last())).toEqual(['m2', 'm1']);
  }, T);

  // Spec: subscription covers the newest page only (default 50)
  test('default page size: 55 messages -> only the 50 newest', async () => {
    const c = newChatId();
    const pad = (n) => String(n).padStart(3, '0');
    await Promise.all(Array.from({ length: 55 }, (_, k) => put(c, `m${pad(k + 1)}`, (k + 1) * 1000)));
    const s = await subscribe(c);
    await waitFor(() => (s.last()?.length ?? 0) >= 50, 5000, 'at least 50');
    await sleep(300);
    for (const e of s.emissions) expect(e.length).toBeLessThanOrEqual(50);
    expect(ids(s.last())).toEqual(Array.from({ length: 50 }, (_, k) => `m${pad(55 - k)}`));
  }, 15000);

  // Contract: custom pageSize, eviction
  test('custom pageSize 3 with 5 messages -> 3 newest; a 4th arriving evicts the oldest', async () => {
    const c = newChatId();
    for (let i = 1; i <= 5; i++) await put(c, `m${i}`, i * 1000);
    const s = await subscribe(c, { pageSize: 3 });
    await waitFor(() => (s.last()?.length ?? 0) >= 3, 3000, 'page of 3');
    await sleep(300);
    for (const e of s.emissions) expect(e.length).toBeLessThanOrEqual(3);
    expect(ids(s.last())).toEqual(['m5', 'm4', 'm3']);
    await put(c, 'm6', 6000);
    await waitFor(() => ids(s.last())[0] === 'm6', 3000, 'm6 first');
    await sleep(300);
    expect(ids(s.last())).toEqual(['m6', 'm5', 'm4']);
    expect(s.last()).toHaveLength(3);
  }, T);

  // Contract: eviction while page full; also works without onError but with pageSize
  test('pageSize with no onError: full page keeps size when a new message arrives', async () => {
    const c = newChatId();
    await put(c, 'm1', 1000);
    await put(c, 'm2', 2000);
    const s = await subscribe(c, { withOnError: false, pageSize: 2 });
    await waitFor(() => s.last()?.length === 2, 3000, 'page of 2');
    await put(c, 'm3', 3000);
    await waitFor(() => ids(s.last())[0] === 'm3', 3000, 'm3 first');
    expect(ids(s.last())).toEqual(['m3', 'm2']);
  }, T);

  // Contract: other chats never appear
  test('messages of other chats never appear nor change the list', async () => {
    const c = newChatId();
    const other = newChatId();
    await put(c, 'm1', 1000);
    const s = await subscribe(c);
    await waitFor(() => s.last()?.length === 1, 3000, 'initial message');
    await put(other, 'x1', 2000);
    await put(other, 'x2', 3000);
    await sleep(700);
    for (const e of s.emissions) expect(ids(e).every((id) => id === 'm1')).toBe(true);
    expect(ids(s.last())).toEqual(['m1']);
  }, T);

  // Spec §5 AC5 (AC#15): stops after unsubscribe
  test('no further onChange calls after unsubscribe', async () => {
    const c = newChatId();
    const s = await subscribe(c);
    await waitFor(() => s.emissions.length >= 1, 3000, 'initial emission');
    s.unsubscribe();
    const count = s.emissions.length;
    await put(c, 'm1', 1000);
    await updateDoc(ref(c, 'm1'), { message: 'changed' });
    await sleep(700);
    expect(s.emissions.length).toBe(count);
  }, T);

  // Contract: idempotent unsubscribe
  test('calling unsubscribe twice does not throw', async () => {
    const s = await subscribe(newChatId());
    await waitFor(() => s.emissions.length >= 1, 3000, 'initial emission');
    s.unsubscribe();
    expect(() => s.unsubscribe()).not.toThrow();
  }, T);

  // Contract: onError optional
  test('subscribing without onError does not throw', async () => {
    const s = await subscribe(newChatId(), { withOnError: false });
    await waitFor(() => s.emissions.length >= 1, 3000, 'initial emission');
    expect(s.emissions[0]).toEqual([]);
  }, T);

  // Contract: independent subscriptions
  test('two subscriptions on different chats are independent', async () => {
    const c1 = newChatId();
    const c2 = newChatId();
    const s1 = await subscribe(c1);
    const s2 = await subscribe(c2);
    await waitFor(() => s1.emissions.length >= 1 && s2.emissions.length >= 1, 3000, 'initial');
    await put(c1, 'a1', 1000);
    await put(c2, 'b1', 2000);
    await waitFor(
      () => ids(s1.last()).join() === 'a1' && ids(s2.last()).join() === 'b1',
      3000,
      'each sees only own message',
    );
    for (const e of s1.emissions) expect(ids(e).every((i) => i === 'a1')).toBe(true);
    for (const e of s2.emissions) expect(ids(e).every((i) => i === 'b1')).toBe(true);
    // unsubscribing one leaves the other alive
    s1.unsubscribe();
    const n1 = s1.emissions.length;
    await put(c2, 'b2', 3000);
    await waitFor(() => ids(s2.last())[0] === 'b2', 3000, 'second still live');
    await sleep(300);
    expect(s1.emissions.length).toBe(n1);
  }, T);
});
