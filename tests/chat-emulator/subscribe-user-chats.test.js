import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

import { clearDatabase, db, loadChatService } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

const T = 5000; // per-test timeout (ms)
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

async function subscribe(userId, withOnError = true) {
  const service = await loadChatService();
  expect(typeof service.subscribeToUserChats).toBe('function');
  const emissions = [];
  const onChange = (chats) => emissions.push(chats);
  const unsubscribe = withOnError
    ? service.subscribeToUserChats(userId, onChange, () => {})
    : service.subscribeToUserChats(userId, onChange);
  expect(typeof unsubscribe).toBe('function');
  unsubs.push(unsubscribe);
  return { emissions, unsubscribe, last: () => emissions[emissions.length - 1] };
}

const rawChat = (userIds, lastMs, extra = {}) => ({
  type: userIds.length === 2 ? 'direct' : 'group',
  user_ids: userIds,
  participants: Object.fromEntries(
    userIds.map((u) => [u, { full_name: u.toUpperCase(), avatar_url: null }]),
  ),
  name: null,
  avatar_url: null,
  created_by: null,
  admin_ids: [],
  last_message: null,
  unread_counts: Object.fromEntries(userIds.map((u) => [u, 0])),
  last_message_at: Timestamp.fromMillis(lastMs),
  created_at: Timestamp.fromMillis(lastMs),
  updated_at: Timestamp.fromMillis(lastMs),
  ...extra,
});

const put = (id, data) => setDoc(doc(db, 'chats', id), data);
const ids = (chats) => chats.map((c) => c.id);

describe('subscribeToUserChats', () => {
  // Spec §3.2 subscribeToUserChats: returns the unsubscribe function
  test('returns a function synchronously', async () => {
    const service = await loadChatService();
    expect(typeof service.subscribeToUserChats).toBe('function');
    const unsubscribe = service.subscribeToUserChats('alice', () => {});
    unsubs.push(unsubscribe);
    expect(typeof unsubscribe).toBe('function');
  }, T);

  // Spec §3.2 onSnapshot on same query: initial emission, empty list
  test('emits [] initially when the user has no chats', async () => {
    const s = await subscribe('alice');
    await waitFor(() => s.emissions.length >= 1, 2500, 'initial emission');
    expect(s.emissions[0]).toEqual([]);
  }, T);

  // Spec §3.2 same query as listUserChats (user_ids contains, last_message_at desc), §3.1 Chat shape
  test('initial emission has the full list, newest first, camelCase with Dates', async () => {
    await put('a_b', rawChat(['a', 'b'], 1_000_000));
    await put('a_c', rawChat(['a', 'c'], 3_000_000));
    await put('a_d', rawChat(['a', 'd'], 2_000_000));
    const s = await subscribe('a');
    await waitFor(() => s.emissions.some((e) => e.length === 3), 2500, 'three chats');
    const list = s.last();
    expect(ids(list)).toEqual(['a_c', 'a_d', 'a_b']);
    expect(list[0].userIds).toEqual(['a', 'c']);
    expect(list[0].unreadCounts).toEqual({ a: 0, c: 0 });
    expect(list[0].lastMessageAt).toBeInstanceOf(Date);
    expect(list[0].lastMessageAt.getTime()).toBe(3_000_000);
  }, T);

  // Spec §3.2 same query: chats of other users excluded
  test('never includes chats of other users', async () => {
    await put('a_b', rawChat(['a', 'b'], 1_000_000));
    await put('x_y', rawChat(['x', 'y'], 2_000_000));
    const s = await subscribe('a');
    await waitFor(() => s.emissions.length >= 1, 2500, 'initial emission');
    await put('y_z', rawChat(['y', 'z'], 3_000_000));
    await sleep(500);
    for (const e of s.emissions) {
      expect(ids(e).every((id) => id === 'a_b')).toBe(true);
    }
    expect(ids(s.last())).toEqual(['a_b']);
  }, T);

  // Spec §5 Messages AC5 (AC#15): emits on remote changes - new chat
  test('emits again when a new chat containing the user appears', async () => {
    const s = await subscribe('a');
    await waitFor(() => s.emissions.length >= 1, 2500, 'initial emission');
    await put('a_b', rawChat(['a', 'b'], 1_000_000));
    await waitFor(() => s.last().length === 1, 2500, 'new chat emitted');
    expect(ids(s.last())).toEqual(['a_b']);
  }, T);

  // Spec §5 AC5: emits on last_message_at change and reorders
  test('reorders when a chat last_message_at changes', async () => {
    await put('a_b', rawChat(['a', 'b'], 1_000_000));
    await put('a_c', rawChat(['a', 'c'], 2_000_000));
    const s = await subscribe('a');
    await waitFor(() => s.last()?.length === 2, 2500, 'initial two chats');
    expect(ids(s.last())).toEqual(['a_c', 'a_b']);
    await updateDoc(doc(db, 'chats', 'a_b'), { last_message_at: Timestamp.fromMillis(5_000_000) });
    await waitFor(() => ids(s.last())[0] === 'a_b', 2500, 'a_b moved to top');
    expect(ids(s.last())).toEqual(['a_b', 'a_c']);
  }, T);

  // Spec §5 AC5: emits when a chat is modified (unread_counts)
  test('emits when a chat is modified (unread_counts)', async () => {
    await put('a_b', rawChat(['a', 'b'], 1_000_000));
    const s = await subscribe('a');
    await waitFor(() => s.emissions.length >= 1, 2500, 'initial emission');
    await updateDoc(doc(db, 'chats', 'a_b'), { unread_counts: { a: 4, b: 0 } });
    await waitFor(() => s.last()[0]?.unreadCounts?.a === 4, 2500, 'unread_counts updated');
    expect(s.last()[0].unreadCounts).toEqual({ a: 4, b: 0 });
  }, T);

  // Spec §3.2 same query: chat disappears when user leaves user_ids
  test('chat disappears when the user is removed from user_ids', async () => {
    await put('g1', rawChat(['a', 'b', 'c'], 1_000_000));
    const s = await subscribe('a');
    await waitFor(() => s.last()?.length === 1, 2500, 'initial chat');
    await updateDoc(doc(db, 'chats', 'g1'), { user_ids: ['b', 'c'] });
    await waitFor(() => s.last().length === 0, 2500, 'chat removed');
    expect(s.last()).toEqual([]);
  }, T);

  // Spec §5 AC5: stops after unsubscribe
  test('no further onChange calls after unsubscribe', async () => {
    const s = await subscribe('a');
    await waitFor(() => s.emissions.length >= 1, 2500, 'initial emission');
    s.unsubscribe();
    const count = s.emissions.length;
    await put('a_b', rawChat(['a', 'b'], 1_000_000));
    await updateDoc(doc(db, 'chats', 'a_b'), { unread_counts: { a: 1, b: 0 } });
    await sleep(700);
    expect(s.emissions.length).toBe(count);
  }, T);

  // Contract: unsubscribe idempotent
  test('calling unsubscribe twice does not throw', async () => {
    const s = await subscribe('a');
    await waitFor(() => s.emissions.length >= 1, 2500, 'initial emission');
    s.unsubscribe();
    expect(() => s.unsubscribe()).not.toThrow();
  }, T);

  // Contract: onError optional
  test('subscribing without onError does not throw', async () => {
    const s = await subscribe('a', false);
    await waitFor(() => s.emissions.length >= 1, 2500, 'initial emission');
    expect(s.emissions[0]).toEqual([]);
  }, T);

  // Contract: independent subscriptions
  test('two subscriptions for different users receive only their own chats', async () => {
    const sa = await subscribe('a');
    const sx = await subscribe('x');
    await waitFor(() => sa.emissions.length >= 1 && sx.emissions.length >= 1, 2500, 'initial');
    await put('a_b', rawChat(['a', 'b'], 1_000_000));
    await put('x_y', rawChat(['x', 'y'], 2_000_000));
    await waitFor(
      () => ids(sa.last()).join() === 'a_b' && ids(sx.last()).join() === 'x_y',
      2500,
      'each user sees only own chat',
    );
    for (const e of sa.emissions) expect(ids(e).every((i) => i === 'a_b')).toBe(true);
    for (const e of sx.emissions) expect(ids(e).every((i) => i === 'x_y')).toBe(true);
  }, T);
});
