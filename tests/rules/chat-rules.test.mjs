// Checks the `chats` block of firestore.rules against the Firestore emulator (default config, port 8080).
// Legitimate operations call the REAL chat.service.ts; operations the service would block before reaching
// the database use RAW client SDK writes to prove the RULES reject them.
// Usage: bun run test:chat:rules
//
// Spec references (doc/specs/002-chat-service/spec.md): "AC3" = Direct chats #3, "AC5" = Group chats #2
// (only admins manage), "AC10" = Group chats #7 (removed member loses access). DDD = database-design-document.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  connectFirestoreEmulator,
  getFirestore,
  serverTimestamp,
  setDoc,
  setLogLevel,
  Timestamp,
  terminate,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { useClient } from './firebase-stub.mjs';

const projectId = process.env.GCLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !projectId?.startsWith('demo-')) {
  throw new Error('Run inside `firebase emulators:exec` with a demo- project.');
}
setLogLevel('silent');

const databaseId = 'app-db';
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const apps = [];
const clients = {};

function makeClient(uid) {
  const app = initializeApp({ projectId }, uid ?? 'anonymous');
  apps.push(app);
  const firestore = getFirestore(app, databaseId);
  connectFirestoreEmulator(firestore, host, Number(port), uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  return firestore;
}
const client = (uid) => (clients[uid] ??= makeClient(uid));
const anon = () => (clients.__anon ??= makeClient(null));

// ---------------------------------------------------------------- REST seed / read (bypass rules)
const base = () => `http://${host}:${port}/v1/projects/${projectId}/databases/${databaseId}/documents`;

function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toValue(v)])) } };
}

function fromValue(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, fromValue(x)]));
  return undefined;
}

async function seed(path, data) {
  const response = await fetch(`${base()}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toValue(data).mapValue.fields }),
  });
  assert.ok(response.ok, `seed ${path}: ${response.status} ${await response.text()}`);
}

async function readDoc(path) {
  const response = await fetch(`${base()}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  if (response.status === 404) return null;
  assert.ok(response.ok, `read ${path}: ${response.status}`);
  return fromValue({ mapValue: { fields: (await response.json()).fields ?? {} } });
}

async function readMessages(chatId) {
  const response = await fetch(`${base()}/chats/${chatId}/chat_messages?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
  assert.ok(response.ok, `list messages: ${response.status}`);
  const body = await response.json();
  return (body.documents ?? []).map((d) => fromValue({ mapValue: { fields: d.fields ?? {} } }));
}

// ---------------------------------------------------------------- assertions
const isDenied = (error) => error?.code === 'permission-denied' || error?.cause?.code === 'permission-denied';
const denied = (promise) => assert.rejects(promise, isDenied);

// ---------------------------------------------------------------- fixtures
let counter = 0;
// users/{uid} profile docs are seeded for every test user (REST, bypasses rules): the message-create rules pin
// author_snapshot.full_name to users/{auth.uid}.fullName. Seeding starts in users() and is awaited by the seed helpers.
const userSeeds = [];
const usersReady = () => Promise.all(userSeeds);
const part = (uid) => ({ full_name: `Name ${uid}`, avatar_url: null });
const profile = (uid) => ({ fullName: `Name ${uid}`, avatarUrl: null });
/** Fresh, sortable uids for one test (a < b < c < d < e < m), so doc ids never collide between tests. */
function users() {
  const n = ++counter;
  const make = (p) => `${p}${n}x`;
  const u = { a: make('a'), b: make('b'), c: make('c'), d: make('d'), e: make('e'), m: make('m'), n };
  const seeding = Promise.all([u.a, u.b, u.c, u.d, u.e, u.m].map((uid) => seed(`users/${uid}`, profile(uid))));
  seeding.catch(() => {}); // surfaced when usersReady() is awaited
  userSeeds.push(seeding);
  return u;
}
const member = (uid) => ({ userId: uid, profile: profile(uid) });
const epoch = new Date(1_700_000_000_000);

function chatDoc(overrides = {}) {
  return {
    type: 'group',
    user_ids: [],
    participants: {},
    name: 'Grupo',
    avatar_url: null,
    created_by: null,
    admin_ids: [],
    last_message: null,
    last_message_at: epoch,
    unread_counts: {},
    created_at: epoch,
    updated_at: epoch,
    ...overrides,
  };
}

async function seedGroup(t, { members, admins, name = 'Grupo' }) {
  await usersReady();
  const id = `g${t.n}-${++counter}`;
  await seed(
    `chats/${id}`,
    chatDoc({
      user_ids: members,
      participants: Object.fromEntries(members.map((u) => [u, part(u)])),
      unread_counts: Object.fromEntries(members.map((u) => [u, 0])),
      admin_ids: admins,
      created_by: members[0],
      name,
    })
  );
  return id;
}

async function seedDirect(x, y) {
  await usersReady();
  const [first, second] = [x, y].sort();
  const id = `${first}_${second}`;
  await seed(
    `chats/${id}`,
    chatDoc({
      type: 'direct',
      user_ids: [first, second],
      participants: { [first]: part(first), [second]: part(second) },
      unread_counts: { [first]: 0, [second]: 0 },
      name: null,
      avatar_url: null,
      created_by: null,
      admin_ids: [],
    })
  );
  return id;
}

async function seedMessage(chatId, authorId, text = 'hello') {
  await usersReady();
  const id = `m${++counter}`;
  await seed(`chats/${chatId}/chat_messages/${id}`, {
    chat_id: chatId,
    type: 'text',
    author_id: authorId,
    author_snapshot: part(authorId),
    message: text,
    system_event: null,
    is_deleted: false,
    created_at: epoch,
    updated_at: epoch,
  });
  return id;
}

// Raw wire payloads (use serverTimestamp like the service does).
function rawDirect(a, b, overrides = {}) {
  return {
    type: 'direct',
    user_ids: [a, b],
    participants: { [a]: part(a), [b]: part(b) },
    name: null,
    avatar_url: null,
    created_by: null,
    admin_ids: [],
    last_message: null,
    last_message_at: serverTimestamp(),
    unread_counts: { [a]: 0, [b]: 0 },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...overrides,
  };
}

function rawGroup(creator, others, overrides = {}) {
  const ids = [creator, ...others];
  return {
    type: 'group',
    user_ids: ids,
    participants: Object.fromEntries(ids.map((u) => [u, part(u)])),
    name: 'Meu grupo',
    avatar_url: null,
    created_by: creator,
    admin_ids: [creator],
    last_message: null,
    last_message_at: serverTimestamp(),
    unread_counts: Object.fromEntries(ids.map((u) => [u, 0])),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...overrides,
  };
}

function rawText(chatId, author, overrides = {}) {
  return {
    chat_id: chatId,
    type: 'text',
    author_id: author,
    author_snapshot: part(author),
    message: 'olá',
    system_event: null,
    is_deleted: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...overrides,
  };
}

function rawSystem(chatId, actor, overrides = {}) {
  return {
    chat_id: chatId,
    type: 'system',
    author_id: null,
    author_snapshot: null,
    message: null,
    system_event: { kind: 'member_added', actor_id: actor, target_ids: [] },
    is_deleted: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...overrides,
  };
}

const newMsgRef = (uid, chatId) => doc(collection(client(uid), 'chats', chatId, 'chat_messages'));
const chatRef = (uid, chatId) => doc(client(uid), 'chats', chatId);

let service;
const as = (uid) => {
  useClient(client(uid), uid);
  return service;
};
const itemsOf = (page) => (Array.isArray(page) ? page : page.items);

before(async () => {
  service = await import('../../src/domains/chat/services/chat.service.ts');
});

after(async () => {
  await Promise.all(Object.values(clients).map(terminate));
  await Promise.all(apps.map(deleteApp));
});

// ================================================================= AC3: direct chats
// Regression guards (pass even with no chats block): marked [guard] in the name.

test('AC3: getOrCreateDirectChat creates for either user, either order, and is idempotent', async () => {
  const u = users();
  const first = await as(u.a).getOrCreateDirectChat({ currentUser: member(u.a), otherUser: member(u.b) });
  assert.equal(first.id, `${u.a}_${u.b}`);
  assert.deepEqual(first.userIds, [u.a, u.b]);
  const second = await as(u.b).getOrCreateDirectChat({ currentUser: member(u.b), otherUser: member(u.a) });
  assert.equal(second.id, first.id);
  // Again by the creator (existing doc path).
  const third = await as(u.a).getOrCreateDirectChat({ currentUser: member(u.a), otherUser: member(u.b) });
  assert.equal(third.id, first.id);
  // Reverse argument order creating a brand new pair.
  const other = await as(u.d).getOrCreateDirectChat({ currentUser: member(u.d), otherUser: member(u.c) });
  assert.equal(other.id, `${u.c}_${u.d}`);
});

test('AC3: raw canonical direct create by a participant is accepted (control)', async () => {
  const u = users();
  await setDoc(chatRef(u.b, `${u.a}_${u.b}`), rawDirect(u.a, u.b));
});

test('AC3 [guard]: direct create with wrong-order id is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `${u.b}_${u.a}`), rawDirect(u.a, u.b)));
});

test('AC3 [guard]: direct create with unsorted user_ids is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}`), rawDirect(u.a, u.b, { user_ids: [u.b, u.a] })));
  await denied(setDoc(chatRef(u.a, `${u.b}_${u.a}`), rawDirect(u.a, u.b, { user_ids: [u.b, u.a] })));
});

test('AC3 [guard]: direct create whose id does not match user_ids is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.c}`), rawDirect(u.a, u.b)));
  await denied(setDoc(chatRef(u.a, `chat-${u.n}`), rawDirect(u.a, u.b)));
});

test('AC3 [guard]: direct create with 1 or 3 user_ids is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, u.a), rawDirect(u.a, u.a, { user_ids: [u.a] })));
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}_${u.c}`), rawDirect(u.a, u.b, { user_ids: [u.a, u.b, u.c] })));
});

test('AC3 [guard]: direct create with admin_ids or last_message set is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}`), rawDirect(u.a, u.b, { admin_ids: [u.a] })));
  await denied(
    setDoc(
      chatRef(u.a, `${u.a}_${u.b}`),
      rawDirect(u.a, u.b, {
        last_message: { message_id: 'x', author_id: u.a, message: 'hi', created_at: serverTimestamp(), is_deleted: false },
      })
    )
  );
});

test('AC3 [guard]: direct create by someone who is not in user_ids is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.c, `${u.a}_${u.b}`), rawDirect(u.a, u.b)));
});

test('direct chat: raw edits of user_ids or name are denied even for a member', async () => {
  const u = users();
  const id = await seedDirect(u.a, u.b);
  await denied(updateDoc(chatRef(u.a, id), { user_ids: [u.a, u.c], updated_at: serverTimestamp() }));
  await denied(updateDoc(chatRef(u.a, id), { user_ids: [u.a], updated_at: serverTimestamp() }));
  await denied(updateDoc(chatRef(u.a, id), { name: 'Renamed', updated_at: serverTimestamp() }));
  await denied(updateDoc(chatRef(u.a, id), { admin_ids: [u.a], updated_at: serverTimestamp() }));
});

// ================================================================= Reads
test('member reads the chat via getChat; a missing chat resolves null (not an error)', async () => {
  const u = users();
  const id = await seedDirect(u.a, u.b);
  const chat = await as(u.a).getChat(id);
  assert.equal(chat?.id, id);
  assert.equal(await as(u.a).getChat(`nope-${u.n}`), null);
});

test('non-member cannot read an existing chat', async () => {
  const u = users();
  const id = await seedDirect(u.a, u.b);
  await denied(getDoc(chatRef(u.c, id)));
  await assert.rejects(as(u.c).getChat(id), isDenied);
});

test('unauthenticated client cannot read or create chats or messages [guard]', async () => {
  const u = users();
  const id = await seedDirect(u.a, u.b);
  const mid = await seedMessage(id, u.a);
  await denied(getDoc(doc(anon(), 'chats', id)));
  await denied(getDoc(doc(anon(), 'chats', id, 'chat_messages', mid)));
  await denied(getDocs(collection(anon(), 'chats', id, 'chat_messages')));
  await denied(setDoc(doc(anon(), 'chats', `${u.a}_${u.b}`), rawDirect(u.a, u.b)));
});

test('listUserChats(self) returns the member chats; listUserChats(other) is denied', async () => {
  const u = users();
  const direct = await seedDirect(u.a, u.b);
  const group = await seedGroup(u, { members: [u.a, u.c], admins: [u.a] });
  await seedDirect(u.b, u.c);
  const ids = itemsOf(await as(u.a).listUserChats(u.a)).map((c) => c.id);
  assert.deepEqual([...ids].sort(), [direct, group].sort());
  await assert.rejects(as(u.a).listUserChats(u.b), isDenied);
});

// ================================================================= Group creation
test('createGroupChat succeeds and writes the chat plus the group_created message in one batch', async () => {
  const u = users();
  const chat = await as(u.a).createGroupChat({ creator: member(u.a), members: [member(u.b), member(u.c)], name: 'Turma' });
  assert.deepEqual(chat.userIds, [u.a, u.b, u.c]);
  const stored = await readDoc(`chats/${chat.id}`);
  assert.deepEqual(stored.admin_ids, [u.a]);
  assert.equal(stored.created_by, u.a);
  const messages = await readMessages(chat.id);
  assert.ok(messages.some((m) => m.type === 'system' && m.system_event.kind === 'group_created'));
});

test('raw group create by creator is accepted (control)', async () => {
  const u = users();
  await setDoc(chatRef(u.a, `raw-${u.n}`), rawGroup(u.a, [u.b]));
});

test('group create with a creator mismatch via the service is denied', async () => {
  const u = users();
  await assert.rejects(
    as(u.b).createGroupChat({ creator: member(u.a), members: [member(u.b), member(u.c)], name: 'Falso' }),
    isDenied
  );
});

test('group create denied [guard]: creator not first, admin_ids, created_by, name, last_message, type', async () => {
  const u = users();
  const ref = (suffix) => chatRef(u.a, `bad-${u.n}-${suffix}`);
  await denied(setDoc(ref(1), rawGroup(u.a, [u.b], { user_ids: [u.b, u.a] })));
  await denied(setDoc(ref(2), rawGroup(u.a, [u.b], { admin_ids: [u.a, u.b] })));
  await denied(setDoc(ref(3), rawGroup(u.a, [u.b], { admin_ids: [u.b] })));
  await denied(setDoc(ref(4), rawGroup(u.a, [u.b], { admin_ids: [] })));
  await denied(setDoc(ref(5), rawGroup(u.a, [u.b], { created_by: u.b })));
  await denied(setDoc(ref(6), rawGroup(u.a, [u.b], { created_by: null })));
  await denied(setDoc(ref(7), rawGroup(u.a, [u.b], { name: '' })));
  await denied(setDoc(ref(8), rawGroup(u.a, [u.b], { name: 'x'.repeat(61) })));
  await denied(setDoc(ref(9), rawGroup(u.a, [u.b], { name: null })));
  await denied(
    setDoc(
      ref(10),
      rawGroup(u.a, [u.b], {
        last_message: { message_id: 'x', author_id: u.a, message: 'hi', created_at: serverTimestamp(), is_deleted: false },
      })
    )
  );
  await denied(setDoc(ref(11), rawGroup(u.a, [u.b], { type: 'channel' })));
  await denied(setDoc(ref(12), rawGroup(u.a, [u.b], { type: 'private' })));
});

test('group create denied [guard]: 101 members, a single member, creator absent', async () => {
  const u = users();
  const many = Array.from({ length: 100 }, (_, i) => `z${u.n}-${i}`);
  await denied(setDoc(chatRef(u.a, `big-${u.n}`), rawGroup(u.a, many))); // 101 total
  await denied(setDoc(chatRef(u.a, `solo-${u.n}`), rawGroup(u.a, [])));
  await denied(setDoc(chatRef(u.a, `other-${u.n}`), rawGroup(u.b, [u.c])));
});

test('group create accepts exactly 100 members', async () => {
  const u = users();
  const many = Array.from({ length: 99 }, (_, i) => `z${u.n}-${i}`);
  await setDoc(chatRef(u.a, `full-${u.n}`), rawGroup(u.a, many));
});

// ================================================================= Messages
test('sendChatMessage by a member succeeds and updates preview and counters', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  const sent = await as(u.b).sendChatMessage({ chatId: id, authorId: u.b, authorSnapshot: profile(u.b), message: 'oi gente' });
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.last_message.message, 'oi gente');
  assert.equal(chat.last_message.message_id, sent.id);
  assert.equal(chat.unread_counts[u.a], 1);
  assert.equal(chat.unread_counts[u.c], 1);
  assert.equal(chat.unread_counts[u.b], 0);
});

test('sendChatMessage by a non-member is denied [guard]', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await assert.rejects(
    as(u.c).sendChatMessage({ chatId: id, authorId: u.c, authorSnapshot: profile(u.c), message: 'intruso' }),
    isDenied
  );
  await denied(setDoc(newMsgRef(u.c, id), rawText(id, u.c)));
});

test('raw text message create by a member is accepted (control)', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await setDoc(newMsgRef(u.b, id), rawText(id, u.b));
  await setDoc(newMsgRef(u.b, id), rawText(id, u.b, { message: 'x'.repeat(2000) }));
});

test('raw message create denied [guard]: forged author, long/empty body, wrong chat_id, is_deleted', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.a)));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { message: 'x'.repeat(2001) })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { message: '' })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { message: null })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { chat_id: 'other-chat' })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { is_deleted: true })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { author_id: null })));
});

test('system messages: forged actor, null-author text and authored system are denied; plain member member_added denied (HARDEN a)', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  // HARDEN (a): a plain (non-admin) member may no longer create a member_added message, even as the actor.
  await denied(setDoc(newMsgRef(u.b, id), rawSystem(id, u.b)));
  await denied(setDoc(newMsgRef(u.b, id), rawSystem(id, u.a))); // forged actor
  await denied(setDoc(newMsgRef(u.b, id), rawSystem(id, u.b, { author_id: u.b }))); // system with an author
  await denied(setDoc(newMsgRef(u.b, id), rawSystem(id, u.b, { system_event: null }))); // missing event
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { author_id: null }))); // text without author
});

test('markChatAsRead: member succeeds, non-member denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await seed(`chats/${id}`, {
    ...chatDoc({
      user_ids: [u.a, u.b],
      participants: { [u.a]: part(u.a), [u.b]: part(u.b) },
      unread_counts: { [u.a]: 4, [u.b]: 3 },
      admin_ids: [u.a],
      created_by: u.a,
    }),
  });
  await as(u.b).markChatAsRead(id, u.b);
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.unread_counts[u.b], 0);
  assert.equal(chat.unread_counts[u.a], 4);
  await assert.rejects(as(u.c).markChatAsRead(id, u.c), isDenied);
});

test('listChatMessages: member works, non-member denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await seedMessage(id, u.a, 'um');
  await seedMessage(id, u.b, 'dois');
  assert.equal(itemsOf(await as(u.b).listChatMessages(id)).length, 2);
  await assert.rejects(as(u.c).listChatMessages(id), isDenied);
});

test('updateChatMessage by the author succeeds', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  const mid = await seedMessage(id, u.b, 'antes');
  await as(u.b).updateChatMessage(id, mid, 'depois');
  assert.equal((await readDoc(`chats/${id}/chat_messages/${mid}`)).message, 'depois');
});

test('raw message update: non-author denied; author changing author_id/created_at/chat_id denied; body accepted', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  const mid = await seedMessage(id, u.b, 'original');
  const ref = (uid) => doc(client(uid), 'chats', id, 'chat_messages', mid);
  await denied(updateDoc(ref(u.a), { message: 'editado por outro', updated_at: serverTimestamp() }));
  await denied(updateDoc(ref(u.a), { is_deleted: true, updated_at: serverTimestamp() }));
  await denied(updateDoc(ref(u.c), { message: 'intruso', updated_at: serverTimestamp() }));
  await denied(updateDoc(ref(u.b), { author_id: u.a, updated_at: serverTimestamp() }));
  await denied(updateDoc(ref(u.b), { created_at: serverTimestamp() }));
  await denied(updateDoc(ref(u.b), { chat_id: 'other', updated_at: serverTimestamp() }));
  await updateDoc(ref(u.b), { message: 'ok', updated_at: serverTimestamp() }); // control
});

test('softDeleteChatMessage by the author succeeds and marks the preview deleted', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  const sent = await as(u.b).sendChatMessage({ chatId: id, authorId: u.b, authorSnapshot: profile(u.b), message: 'apagar' });
  await as(u.b).softDeleteChatMessage(id, sent.id);
  assert.equal((await readDoc(`chats/${id}/chat_messages/${sent.id}`)).is_deleted, true);
  assert.equal((await readDoc(`chats/${id}`)).last_message.is_deleted, true);
});

test('raw deletes of messages and chats are denied (soft delete only) [guard]', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  const mid = await seedMessage(id, u.a);
  await denied(deleteDoc(doc(client(u.a), 'chats', id, 'chat_messages', mid)));
  await denied(deleteDoc(doc(client(u.b), 'chats', id, 'chat_messages', mid)));
  await denied(deleteDoc(chatRef(u.a, id)));
  await denied(deleteDoc(chatRef(u.b, id)));
  const direct = await seedDirect(u.c, u.d);
  await denied(deleteDoc(chatRef(u.c, direct)));
});

// ================================================================= AC5: group admin
test('AC5: addGroupMembers by an admin succeeds with a member_added message', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await as(u.a).addGroupMembers({ chatId: id, actorId: u.a, members: [member(u.c), member(u.d)] });
  const chat = await readDoc(`chats/${id}`);
  assert.deepEqual(chat.user_ids, [u.a, u.b, u.c, u.d]);
  assert.equal(chat.unread_counts[u.c], 0);
  assert.ok(chat.participants[u.d]);
  const messages = await readMessages(id);
  assert.ok(messages.some((m) => m.system_event?.kind === 'member_added' && m.system_event.actor_id === u.a));
});

test('AC5: removeGroupMember by an admin succeeds with a member_removed message', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await as(u.a).removeGroupMember(id, u.a, u.b);
  const chat = await readDoc(`chats/${id}`);
  assert.deepEqual(chat.user_ids, [u.a, u.c]);
  assert.equal(chat.participants[u.b], undefined);
  assert.equal(chat.unread_counts[u.b], undefined);
  const messages = await readMessages(id);
  assert.ok(messages.some((m) => m.system_event?.kind === 'member_removed' && m.system_event.actor_id === u.a));
});

test('AC5: setGroupAdmin promote and demote by an admin succeed with system messages', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await as(u.a).setGroupAdmin(id, u.a, u.b, true);
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids.sort(), [u.a, u.b].sort());
  await as(u.a).setGroupAdmin(id, u.a, u.b, false);
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.a]);
  const kinds = (await readMessages(id)).map((m) => m.system_event?.kind);
  assert.ok(kinds.includes('admin_promoted') && kinds.includes('admin_demoted'));
});

test('AC5 [guard]: non-admin raw updates of membership, roles, name, avatar and participants are denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  const upd = (changes) => updateDoc(chatRef(u.b, id), { updated_at: serverTimestamp(), ...changes });
  await denied(upd({ user_ids: [u.a, u.b, u.c, u.d] })); // add someone
  await denied(upd({ user_ids: [u.a, u.b] })); // remove someone else
  await denied(upd({ user_ids: [u.b, u.a, u.c] })); // reorder
  await denied(upd({ admin_ids: [u.a, u.b] })); // self-promote
  await denied(upd({ admin_ids: [] })); // demote the admin
  await denied(upd({ name: 'Renomeado' }));
  await denied(upd({ avatar_url: 'http://x/y.png' }));
  await denied(upd({ participants: { [u.a]: part(u.a), [u.b]: { full_name: 'Hacked', avatar_url: null }, [u.c]: part(u.c) } }));
  await denied(upd({ created_by: u.b }));
  await denied(upd({ type: 'direct' }));
});

test('AC5 [guard]: non-member raw updates of a group are denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(updateDoc(chatRef(u.c, id), { user_ids: [u.a, u.b, u.c], updated_at: serverTimestamp() })); // adds self
  await denied(updateDoc(chatRef(u.c, id), { last_message_at: serverTimestamp(), updated_at: serverTimestamp() }));
});

test('AC5: admin raw rename and avatar change succeed', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await updateDoc(chatRef(u.a, id), { name: 'Novo nome', updated_at: serverTimestamp() });
  await updateDoc(chatRef(u.a, id), { avatar_url: 'http://x/new.png', updated_at: serverTimestamp() });
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.name, 'Novo nome');
  assert.equal(chat.avatar_url, 'http://x/new.png');
});

test('AC5 [guard]: admin raw updates of immutable fields or oversized membership are denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  const upd = (changes) => updateDoc(chatRef(u.a, id), { updated_at: serverTimestamp(), ...changes });
  await denied(upd({ type: 'direct' }));
  await denied(upd({ created_by: u.b }));
  await denied(upd({ created_at: serverTimestamp() }));
  await denied(upd({ last_message_at: serverTimestamp(), user_ids: [u.a, u.b, u.c], created_by: u.b }));
  await denied(upd({ user_ids: [u.a, u.b, u.c], type: 'direct' }));
  const big = Array.from({ length: 99 }, (_, i) => `z${u.n}-${i}`);
  await denied(upd({ user_ids: [u.a, u.b, ...big] })); // 101 entries
  await upd({ user_ids: [u.a, u.b, ...big.slice(0, 98)] }); // 100 entries: control
});

// ================================================================= Leaving
test('leaveGroupChat by a plain member succeeds', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await as(u.b).leaveGroupChat(id, u.b);
  const chat = await readDoc(`chats/${id}`);
  assert.deepEqual(chat.user_ids, [u.a, u.c]);
  assert.equal(chat.participants[u.b], undefined);
  assert.ok((await readMessages(id)).some((m) => m.system_event?.kind === 'member_left' && m.system_event.actor_id === u.b));
});

test('leaveGroupChat by the sole admin promotes the oldest remaining member', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await as(u.a).leaveGroupChat(id, u.a);
  const chat = await readDoc(`chats/${id}`);
  assert.deepEqual(chat.user_ids, [u.b, u.c]);
  assert.deepEqual(chat.admin_ids, [u.b]);
  const events = (await readMessages(id)).map((m) => m.system_event).filter(Boolean);
  assert.ok(events.some((e) => e.kind === 'admin_promoted' && e.actor_id === u.a));
  assert.ok(events.some((e) => e.kind === 'member_left' && e.actor_id === u.a));
});

test('the last member leaving leaves an empty group', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a], admins: [u.a] });
  await as(u.a).leaveGroupChat(id, u.a);
  const chat = await readDoc(`chats/${id}`);
  assert.deepEqual(chat.user_ids, []);
  assert.deepEqual(chat.admin_ids, []);
});

test('leaving [guard]: a member cannot leave while also removing someone else', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  const upd = (changes) => updateDoc(chatRef(u.b, id), { updated_at: serverTimestamp(), ...changes });
  await denied(upd({ user_ids: [u.a] })); // removes self and c
  await denied(upd({ user_ids: [u.c] })); // removes self and a
  await denied(upd({ user_ids: [u.a, u.c, u.d] })); // swaps self for d
  await denied(upd({ user_ids: [u.a, u.c], name: 'Sai e renomeia' })); // leaves and renames
  await upd({ user_ids: [u.a, u.c] }); // control: only self removed (participants left in place is tolerated)
});

test('leaving [guard]: a non-member cannot add themselves; a direct-chat member cannot leave', async () => {
  const u = users();
  const group = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(updateDoc(chatRef(u.c, group), { user_ids: [u.a, u.b, u.c], updated_at: serverTimestamp() }));
  const direct = await seedDirect(u.a, u.d);
  await denied(updateDoc(chatRef(u.a, direct), { user_ids: [u.d], updated_at: serverTimestamp() }));
});

// ================================================================= Leaving: hardening of the "member leaving" rule
// A leaver may only remove themself: admin_ids must be (i) unchanged minus the leaver, or (ii) only when the leaver was the
// sole admin and members remain, exactly [oldest remaining member]; [] when the group becomes empty. participants and
// unread_counts may differ only in the leaver's own key. (AC5: only admins promote/demote, at the rules layer.)
const without = (map, key) => Object.fromEntries(Object.entries(map).filter(([k]) => k !== key));
const leaveRaw = (leaver, id, changes) => updateDoc(chatRef(leaver, id), { updated_at: serverTimestamp(), ...changes });

/** The honest leave payload: leaver removed from user_ids and from their own participants/unread entries. */
function honestLeave(members, leaver, counts = Object.fromEntries(members.map((m) => [m, 0]))) {
  return {
    user_ids: members.filter((m) => m !== leaver),
    participants: without(Object.fromEntries(members.map((m) => [m, part(m)])), leaver),
    unread_counts: without(counts, leaver),
  };
}

test('leaving hardening (controls): raw plain-member, non-sole-admin, sole-admin and last-member leaves are accepted', async () => {
  const u = users();
  const members = [u.a, u.b, u.c, u.d];
  // plain member, admin_ids unchanged
  let id = await seedGroup(u, { members, admins: [u.a] });
  await leaveRaw(u.c, id, { ...honestLeave(members, u.c), admin_ids: [u.a] });
  assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, [u.a, u.b, u.d]);
  // non-sole admin: admin_ids minus the leaver, order preserved
  id = await seedGroup(u, { members, admins: [u.a, u.b] });
  await leaveRaw(u.a, id, { ...honestLeave(members, u.a), admin_ids: [u.b] });
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.b]);
  // sole admin: exactly [oldest remaining member]
  id = await seedGroup(u, { members, admins: [u.a] });
  await leaveRaw(u.a, id, { ...honestLeave(members, u.a), admin_ids: [u.b] });
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.b]);
  // last member: everything empty
  id = await seedGroup(u, { members: [u.a], admins: [u.a] });
  await leaveRaw(u.a, id, { user_ids: [], admin_ids: [], participants: {}, unread_counts: {} });
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, []);
});

test('leaving hardening (AC5): a plain member leaving cannot make an accomplice an admin', async () => {
  const u = users();
  const members = [u.a, u.b, u.c, u.d];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const leave = honestLeave(members, u.b);
  await denied(leaveRaw(u.b, id, { ...leave, admin_ids: [u.a, u.c] })); // accomplice promoted
  await denied(leaveRaw(u.b, id, { ...leave, admin_ids: [u.c] })); // admin swapped for accomplice
  await leaveRaw(u.b, id, { ...leave, admin_ids: [u.a] }); // control
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.a]);
});

test('leaving hardening (AC5): a plain member leaving cannot wipe admin_ids', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const leave = honestLeave(members, u.b);
  await denied(leaveRaw(u.b, id, { ...leave, admin_ids: [] }));
  await leaveRaw(u.b, id, { ...leave, admin_ids: [u.a] }); // control
});

test('leaving hardening (AC5): a non-sole admin leaving cannot add a third member to admin_ids', async () => {
  const u = users();
  const members = [u.a, u.b, u.c, u.d];
  const id = await seedGroup(u, { members, admins: [u.a, u.b] });
  const leave = honestLeave(members, u.a);
  await denied(leaveRaw(u.a, id, { ...leave, admin_ids: [u.b, u.c] }));
  await denied(leaveRaw(u.a, id, { ...leave, admin_ids: [u.a, u.b] })); // leaver stays admin
  await leaveRaw(u.a, id, { ...leave, admin_ids: [u.b] }); // control
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.b]);
});

test('leaving hardening (AC5): a sole admin leaving must promote exactly the oldest remaining member', async () => {
  const u = users();
  const members = [u.a, u.b, u.c, u.d];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const leave = honestLeave(members, u.a);
  await denied(leaveRaw(u.a, id, { ...leave, admin_ids: [u.c] })); // not the oldest (user_ids_after[1])
  await denied(leaveRaw(u.a, id, { ...leave, admin_ids: [u.d] }));
  await denied(leaveRaw(u.a, id, { ...leave, admin_ids: [u.b, u.c] })); // two promoted
  await denied(leaveRaw(u.a, id, { ...leave, admin_ids: [] })); // members remain, nobody promoted
  await denied(leaveRaw(u.a, id, { ...leave, admin_ids: [u.a] })); // leaver keeps admin
  await leaveRaw(u.a, id, { ...leave, admin_ids: [u.b] }); // control
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.b]);
});

test('leaving hardening (AC5): a plain member leaving cannot promote the oldest member while an admin remains', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.c] });
  const leave = honestLeave(members, u.b); // user_ids_after = [a, c]
  await denied(leaveRaw(u.b, id, { ...leave, admin_ids: [u.c, u.a] }));
  await denied(leaveRaw(u.b, id, { ...leave, admin_ids: [u.a] })); // replaces the admin
  await leaveRaw(u.b, id, { ...leave, admin_ids: [u.c] }); // control
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.c]);
});

test('leaving hardening: the last member leaving must leave admin_ids empty', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a], admins: [u.a] });
  const empty = { user_ids: [], participants: {}, unread_counts: {} };
  await denied(leaveRaw(u.a, id, { ...empty, admin_ids: [u.a] }));
  await leaveRaw(u.a, id, { ...empty, admin_ids: [] }); // control
});

test('leaving hardening: a leaver cannot rewrite other members participants entries', async () => {
  const u = users();
  const members = [u.a, u.b, u.c, u.d];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const leave = { ...honestLeave(members, u.b), admin_ids: [u.a] };
  await denied(
    leaveRaw(u.b, id, { ...leave, participants: { ...leave.participants, [u.c]: { full_name: 'Hacked', avatar_url: null } } })
  );
  await denied(leaveRaw(u.b, id, { ...leave, participants: without(leave.participants, u.c) })); // drops someone else's entry
  await denied(leaveRaw(u.b, id, { ...leave, participants: { ...leave.participants, [u.a]: { full_name: 'Admin?', avatar_url: 'x' } } }));
  await leaveRaw(u.b, id, leave); // control
});

test('leaving hardening: a leaver cannot change other members unread_counts', async () => {
  const u = users();
  const members = [u.a, u.b, u.c, u.d];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const counts = { [u.a]: 3, [u.b]: 2, [u.c]: 4, [u.d]: 1 };
  await seed(`chats/${id}`, {
    ...chatDoc({
      user_ids: members,
      participants: Object.fromEntries(members.map((m) => [m, part(m)])),
      unread_counts: counts,
      admin_ids: [u.a],
      created_by: u.a,
    }),
  });
  const leave = { ...honestLeave(members, u.b, counts), admin_ids: [u.a] };
  await denied(leaveRaw(u.b, id, { ...leave, unread_counts: { ...leave.unread_counts, [u.c]: 0 } })); // zeroing
  await denied(leaveRaw(u.b, id, { ...leave, unread_counts: { ...leave.unread_counts, [u.c]: 99 } })); // inflating
  await denied(leaveRaw(u.b, id, { ...leave, unread_counts: without(leave.unread_counts, u.d) })); // dropping
  await leaveRaw(u.b, id, leave); // control
  assert.deepEqual((await readDoc(`chats/${id}`)).unread_counts, { [u.a]: 3, [u.c]: 4, [u.d]: 1 });
});

test('leaving hardening: a leaver cannot add new keys to participants or unread_counts', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const leave = { ...honestLeave(members, u.b), admin_ids: [u.a] };
  await denied(leaveRaw(u.b, id, { ...leave, participants: { ...leave.participants, [u.e]: part(u.e) } }));
  await denied(leaveRaw(u.b, id, { ...leave, unread_counts: { ...leave.unread_counts, [u.e]: 0 } }));
  await leaveRaw(u.b, id, leave); // control
});

// ================================================================= AC10: removed members lose access
async function assertLostAccess(u, id, gone, stays) {
  await assert.rejects(as(gone).getChat(id), isDenied);
  await denied(getDoc(chatRef(gone, id)));
  await assert.rejects(as(gone).listChatMessages(id), isDenied);
  await assert.rejects(
    as(gone).sendChatMessage({ chatId: id, authorId: gone, authorSnapshot: profile(gone), message: 'ainda aqui?' }),
    isDenied
  );
  await denied(setDoc(newMsgRef(gone, id), rawText(id, gone)));
  await assert.rejects(as(gone).markChatAsRead(id, gone), isDenied);
  assert.ok(!itemsOf(await as(gone).listUserChats(gone)).some((c) => c.id === id));
  // Remaining members are unaffected.
  assert.equal((await as(stays).getChat(id))?.id, id);
  assert.ok(Array.isArray(itemsOf(await as(stays).listChatMessages(id))));
  await as(stays).sendChatMessage({ chatId: id, authorId: stays, authorSnapshot: profile(stays), message: 'continuamos' });
  await as(stays).markChatAsRead(id, stays);
  assert.ok(itemsOf(await as(stays).listUserChats(stays)).some((c) => c.id === id));
}

test('AC10: a member removed by an admin loses all access; the others keep it', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await seedMessage(id, u.c, 'antes');
  await as(u.a).removeGroupMember(id, u.a, u.c);
  await assertLostAccess(u, id, u.c, u.b);
});

test('AC10: a member who left loses all access; the others keep it', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await seedMessage(id, u.b, 'antes');
  await as(u.b).leaveGroupChat(id, u.b);
  await assertLostAccess(u, id, u.b, u.a);
});

// ================================================================= AC5: updateGroupInfo through the real service
const renamedEvents = async (id) => (await readMessages(id)).filter((m) => m.system_event?.kind === 'group_renamed');

test('AC5: updateGroupInfo rename by an admin succeeds with a group_renamed message', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a], name: 'Antigo' });
  await as(u.a).updateGroupInfo({ chatId: id, actorId: u.a, name: '  Novo nome  ' });
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.name, 'Novo nome');
  assert.ok(chat.updated_at.getTime() > epoch.getTime(), 'updated_at bumped');
  const events = await renamedEvents(id);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'system');
  assert.equal(events[0].system_event.actor_id, u.a);
  assert.deepEqual(events[0].system_event.target_ids, []);
  // A plain member can read the message straight from Firestore.
  const snap = await getDocs(collection(client(u.b), 'chats', id, 'chat_messages'));
  assert.ok(snap.docs.some((d) => d.data().system_event?.kind === 'group_renamed'));
});

test('AC5: updateGroupInfo avatar-only change by an admin succeeds and writes no system message', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a], name: 'Grupo X' });
  await as(u.a).updateGroupInfo({ chatId: id, actorId: u.a, avatarUrl: 'http://x/avatar.png' });
  let chat = await readDoc(`chats/${id}`);
  assert.equal(chat.avatar_url, 'http://x/avatar.png');
  assert.equal(chat.name, 'Grupo X');
  assert.equal((await readMessages(id)).length, 0);
  await as(u.a).updateGroupInfo({ chatId: id, actorId: u.a, avatarUrl: null });
  chat = await readDoc(`chats/${id}`);
  assert.equal(chat.avatar_url, null);
  assert.equal(chat.name, 'Grupo X');
  assert.equal((await readMessages(id)).length, 0);
});

test('AC5: updateGroupInfo rename and avatar together by a non-creator admin succeeds', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a, u.b] });
  await as(u.b).updateGroupInfo({ chatId: id, actorId: u.b, name: 'Nome B', avatarUrl: 'http://x/b.png' });
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.name, 'Nome B');
  assert.equal(chat.avatar_url, 'http://x/b.png');
  assert.notEqual(chat.created_by, u.b);
  const events = await renamedEvents(id);
  assert.equal(events.length, 1);
  assert.equal(events[0].system_event.actor_id, u.b);
});

test('AC5 [guard]: a plain member cannot rename or change the avatar via raw updates, nor forge a group_renamed message', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a], name: 'Original' });
  const forged = (actor, overrides = {}) =>
    rawSystem(id, actor, { system_event: { kind: 'group_renamed', actor_id: actor, target_ids: [] }, ...overrides });
  await denied(setDoc(newMsgRef(u.b, id), forged(u.a))); // forged actor (the admin)
  await denied(updateDoc(chatRef(u.b, id), { name: 'Hacked', updated_at: serverTimestamp() }));
  await denied(updateDoc(chatRef(u.b, id), { avatar_url: 'http://x/h.png', updated_at: serverTimestamp() }));
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.name, 'Original');
  assert.equal(chat.avatar_url, null);
  assert.equal((await renamedEvents(id)).length, 0);
});

test('AC5: updateGroupInfo by a user removed from the group is rejected', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a, u.b], name: 'Intacto' });
  await as(u.a).removeGroupMember(id, u.a, u.b);
  await assert.rejects(as(u.b).updateGroupInfo({ chatId: id, actorId: u.b, name: 'Invasor' }), (e) => e?.code === 'CHAT_NOT_ADMIN' || isDenied(e));
  await assert.rejects(as(u.b).updateGroupInfo({ chatId: id, actorId: u.b, avatarUrl: 'http://x/i.png' }), (e) => e?.code === 'CHAT_NOT_ADMIN' || isDenied(e));
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.name, 'Intacto');
  assert.equal(chat.avatar_url, null);
  assert.equal((await renamedEvents(id)).length, 0);
});

// ================================================================= HARDENING (spec §7.4 a-g)
const sysEvent = (kind, actor, targets = []) => ({ kind, actor_id: actor, target_ids: targets });
const sysMsg = (chatId, actor, kind, targets = [], overrides = {}) =>
  rawSystem(chatId, actor, { system_event: sysEvent(kind, actor, targets), ...overrides });
const omit = (obj, ...keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const messageCount = async (chatId) => (await readMessages(chatId)).length;
const assertNoMessages = async (chatId) => assert.equal(await messageCount(chatId), 0, 'a denied write must leave no message');
const ADMIN_KINDS = ['member_added', 'member_removed', 'admin_promoted', 'admin_demoted', 'group_renamed'];

/** One atomic batch: optional chat update plus message creates, all by `uid`. */
async function commit(uid, chatId, chatChanges, messages) {
  const batch = writeBatch(client(uid));
  if (chatChanges) batch.update(chatRef(uid, chatId), { updated_at: serverTimestamp(), ...chatChanges });
  for (const m of messages) batch.set(newMsgRef(uid, chatId), m);
  await batch.commit();
}

// ---------------------------------------------------------------- (c) created_at / updated_at == request time
const badTimes = [
  ['client Date', () => new Date()],
  ['client Timestamp', () => Timestamp.fromDate(new Date())],
  ['epoch Date in the past', () => epoch],
  ['string', () => 'now'],
  ['null', () => null],
];
for (const field of ['created_at', 'updated_at']) {
  for (const [label, make] of badTimes) {
    test(`HARDEN (c): text message with ${field} = ${label} is denied`, async () => {
      const u = users();
      const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
      await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { [field]: make() })));
      await assertNoMessages(id);
    });
  }
  test(`HARDEN (c): system message with ${field} = client Date is denied (admin and leaver)`, async () => {
    const u = users();
    const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
    await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'group_renamed', [], { [field]: new Date() })));
    await denied(commit(u.b, id, { ...honestLeave([u.a, u.b], u.b), admin_ids: [u.a] }, [
      sysMsg(id, u.b, 'member_left', [u.b], { [field]: new Date() }),
    ]));
    await assertNoMessages(id);
    assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, [u.a, u.b], 'batch must be atomic: nobody left');
  });
}

test('HARDEN (c) control: serverTimestamp() text and system messages and the real service are accepted', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await setDoc(newMsgRef(u.b, id), rawText(id, u.b));
  await setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'group_renamed'));
  await as(u.b).sendChatMessage({ chatId: id, authorId: u.b, authorSnapshot: profile(u.b), message: 'via service' });
  assert.equal(await messageCount(id), 3);
  const stored = (await readMessages(id)).find((m) => m.message === 'via service');
  assert.ok(stored.created_at instanceof Date && stored.created_at.getTime() > epoch.getTime());
});

// ---------------------------------------------------------------- (d) exact key set, system_event shape, text/system exclusivity
test('HARDEN (d): text message with an extra top-level key is denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { pinned: true })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { is_admin: true, extra: 'x' })));
  await assertNoMessages(id);
});

test('HARDEN (d): system message with an extra top-level key is denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'group_renamed', [], { extra: 1 })));
  await assertNoMessages(id);
});

for (const key of ['author_snapshot', 'system_event', 'updated_at', 'created_at', 'is_deleted', 'chat_id', 'type', 'author_id', 'message']) {
  test(`HARDEN (d): text message missing the key "${key}" is denied`, async () => {
    const u = users();
    const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
    await denied(setDoc(newMsgRef(u.b, id), omit(rawText(id, u.b), key)));
    await assertNoMessages(id);
  });
}

for (const key of ['author_snapshot', 'message', 'author_id', 'updated_at']) {
  test(`HARDEN (d): system message missing the key "${key}" is denied`, async () => {
    const u = users();
    const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
    await denied(setDoc(newMsgRef(u.a, id), omit(sysMsg(id, u.a, 'group_renamed'), key)));
    await assertNoMessages(id);
  });
}

test('HARDEN (d): a text message carrying a system_event is denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { system_event: sysEvent('member_added', u.b, [u.c]) })));
  await denied(setDoc(newMsgRef(u.a, id), rawText(id, u.a, { system_event: sysEvent('group_renamed', u.a) })));
  await assertNoMessages(id);
});

test('HARDEN (d): a system message must have message == null and author_snapshot == null', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'group_renamed', [], { message: 'Voce foi removido' })));
  await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'group_renamed', [], { message: '' })));
  await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'group_renamed', [], { author_snapshot: part(u.a) })));
  await assertNoMessages(id);
});

test('HARDEN (d): system_event must have exactly kind, actor_id, target_ids', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  const withEvent = (system_event) => setDoc(newMsgRef(u.a, id), rawSystem(id, u.a, { system_event }));
  await denied(withEvent({ kind: 'group_renamed', actor_id: u.a, target_ids: [], note: 'x' })); // extra
  await denied(withEvent({ kind: 'group_renamed', actor_id: u.a })); // missing target_ids
  await denied(withEvent({ kind: 'group_renamed', target_ids: [] })); // missing actor_id
  await denied(withEvent({ actor_id: u.a, target_ids: [] })); // missing kind
  await assertNoMessages(id);
});

test('HARDEN (d): unknown system_event kinds are denied even for an admin', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  for (const kind of ['member_banned', 'group_deleted', 'MEMBER_ADDED', '', 'text']) {
    await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, kind)));
  }
  await denied(setDoc(newMsgRef(u.a, id), rawSystem(id, u.a, { system_event: { kind: null, actor_id: u.a, target_ids: [] } })));
  await assertNoMessages(id);
});

test('HARDEN (d) control: exact key sets are accepted (text, every admin kind) and the real service passes', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await setDoc(newMsgRef(u.b, id), rawText(id, u.b));
  for (const kind of ADMIN_KINDS) await setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, kind, [u.c]));
  await as(u.c).sendChatMessage({ chatId: id, authorId: u.c, authorSnapshot: profile(u.c), message: 'service ok' });
  const stored = await readMessages(id);
  assert.equal(stored.length, 1 + ADMIN_KINDS.length + 1);
  for (const m of stored) {
    assert.deepEqual(
      Object.keys(m).sort(),
      ['author_id', 'author_snapshot', 'chat_id', 'created_at', 'is_deleted', 'message', 'system_event', 'type', 'updated_at']
    );
  }
});

// ---------------------------------------------------------------- (b) author_snapshot.full_name == users/{uid}.fullName
test('HARDEN (b): text message with a different author_snapshot.full_name is denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { author_snapshot: { full_name: `Name ${u.a}`, avatar_url: null } })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { author_snapshot: { full_name: 'Administrador', avatar_url: null } })));
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b, { author_snapshot: { full_name: '', avatar_url: null } })));
  await assertNoMessages(id);
});

test('HARDEN (b): text message is denied when the author has no users/{uid} profile doc', async () => {
  const u = users();
  const ghost = `ghost${u.n}x`; // never seeded under users/
  const id = await seedGroup(u, { members: [u.a, ghost], admins: [u.a] });
  assert.equal(await readDoc(`users/${ghost}`), null);
  await denied(setDoc(newMsgRef(ghost, id), rawText(id, ghost)));
  await assert.rejects(
    as(ghost).sendChatMessage({ chatId: id, authorId: ghost, authorSnapshot: profile(ghost), message: 'sem perfil' }),
    isDenied
  );
  await assertNoMessages(id);
});

test('HARDEN (b): a profile rename is honoured, so the old name is then denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await seed(`users/${u.b}`, { fullName: 'Novo Nome', avatarUrl: null });
  await denied(setDoc(newMsgRef(u.b, id), rawText(id, u.b))); // still the old name
  await setDoc(newMsgRef(u.b, id), rawText(id, u.b, { author_snapshot: { full_name: 'Novo Nome', avatar_url: null } }));
  assert.equal(await messageCount(id), 1);
});

test('HARDEN (b) control: sendChatMessage and raw text with the profile name are accepted', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  const sent = await as(u.b).sendChatMessage({ chatId: id, authorId: u.b, authorSnapshot: profile(u.b), message: 'oi' });
  await setDoc(newMsgRef(u.a, id), rawText(id, u.a));
  assert.equal(await messageCount(id), 2);
  assert.equal((await readDoc(`chats/${id}/chat_messages/${sent.id}`)).author_snapshot.full_name, `Name ${u.b}`);
});

// ---------------------------------------------------------------- (a) who may create which system message
for (const kind of [...ADMIN_KINDS, 'group_created']) {
  test(`HARDEN (a): a plain member cannot create a ${kind} system message`, async () => {
    const u = users();
    const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
    await denied(setDoc(newMsgRef(u.b, id), sysMsg(id, u.b, kind, [u.c])));
    await denied(setDoc(newMsgRef(u.b, id), sysMsg(id, u.b, kind, [])));
    await assertNoMessages(id);
  });
}

test('HARDEN (a): a plain member cannot forge a fake member_removed with free text in message', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.b, id), sysMsg(id, u.b, 'member_removed', [u.c], { message: 'O admin removeu voce' })));
  await assertNoMessages(id);
});

test('HARDEN (a): member_left by a member who is not leaving in the same batch is denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a] });
  // alone
  await denied(setDoc(newMsgRef(u.b, id), sysMsg(id, u.b, 'member_left', [u.b])));
  // with an unrelated, otherwise-legal member update (preview only)
  await denied(commit(u.b, id, { last_message_at: serverTimestamp() }, [sysMsg(id, u.b, 'member_left', [u.b])]));
  // while removing somebody else instead (not even a valid member update, so the whole batch fails)
  await denied(commit(u.b, id, { user_ids: [u.a, u.b] }, [sysMsg(id, u.b, 'member_left', [u.b])]));
  await assertNoMessages(id);
  assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, [u.a, u.b, u.c]);
});

test('HARDEN (a): member_left must have actor_id == uid and target_ids == [uid]', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const leave = { ...honestLeave(members, u.b), admin_ids: [u.a] };
  for (const targets of [[], [u.c], [u.b, u.c], [u.a]]) {
    await denied(commit(u.b, id, leave, [sysMsg(id, u.b, 'member_left', targets)]));
  }
  await denied(commit(u.b, id, leave, [sysMsg(id, u.a, 'member_left', [u.b])])); // forged actor
  await assertNoMessages(id);
  assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, members);
});

test('HARDEN (a): a leaver cannot smuggle a second non-leave system message in the leave batch', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.a] });
  const leave = { ...honestLeave(members, u.b), admin_ids: [u.a] };
  await denied(commit(u.b, id, leave, [sysMsg(id, u.b, 'member_left', [u.b]), sysMsg(id, u.b, 'member_removed', [u.c])]));
  await denied(commit(u.b, id, leave, [sysMsg(id, u.b, 'member_left', [u.b]), sysMsg(id, u.b, 'admin_promoted', [u.c])]));
  await assertNoMessages(id);
  assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, members);
});

test('HARDEN (a): an admin member_left is only accepted when the admin is actually leaving', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a, u.b] });
  await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'member_left', [u.a])));
  await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'member_left', [u.c]))); // somebody else
  await assertNoMessages(id);
});

test('HARDEN (a): an admin cannot write group_created in an existing chat; a non-creator cannot in a new one', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, 'group_created', [])));
  await assertNoMessages(id);
  // new chat created by b, group_created message authored by someone else's actor id
  const newId = `hard-a-${u.n}`;
  const batch = writeBatch(client(u.b));
  batch.set(chatRef(u.b, newId), rawGroup(u.b, [u.c]));
  batch.set(doc(collection(client(u.b), 'chats', newId, 'chat_messages')), sysMsg(newId, u.c, 'group_created', [u.c]));
  await denied(batch.commit());
  assert.equal(await readDoc(`chats/${newId}`), null);
});

test('HARDEN (a) control: an admin may create every admin kind with actor_id == uid and free target_ids', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b, u.c], admins: [u.a, u.b] });
  for (const kind of ADMIN_KINDS) {
    await setDoc(newMsgRef(u.a, id), sysMsg(id, u.a, kind, []));
    await setDoc(newMsgRef(u.b, id), sysMsg(id, u.b, kind, [u.c, 'someone-else']));
  }
  assert.equal(await messageCount(id), ADMIN_KINDS.length * 2);
});

test('HARDEN (a) control: a plain member leaving with member_left [self] in the same batch is accepted', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.a] });
  await commit(u.b, id, { ...honestLeave(members, u.b), admin_ids: [u.a] }, [sysMsg(id, u.b, 'member_left', [u.b])]);
  assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, [u.a, u.c]);
  assert.equal(await messageCount(id), 1);
});

test('HARDEN (a) control: the sole admin leaving writes admin_promoted then member_left, both accepted', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.a] });
  await commit(u.a, id, { ...honestLeave(members, u.a), admin_ids: [u.b] }, [
    sysMsg(id, u.a, 'admin_promoted', [u.b]),
    sysMsg(id, u.a, 'member_left', [u.a]),
  ]);
  assert.deepEqual((await readDoc(`chats/${id}`)).admin_ids, [u.b]);
  assert.equal(await messageCount(id), 2);
});

test('HARDEN (a): a plain member leaving cannot attach admin_promoted (only a leaving sole admin triggers it)', async () => {
  const u = users();
  const members = [u.a, u.b, u.c];
  const id = await seedGroup(u, { members, admins: [u.a] });
  await denied(
    commit(u.b, id, { ...honestLeave(members, u.b), admin_ids: [u.a] }, [
      sysMsg(id, u.b, 'admin_promoted', [u.c]),
      sysMsg(id, u.b, 'member_left', [u.b]),
    ])
  );
  await assertNoMessages(id);
});

test('HARDEN (a) control: real service group operations by their legitimate actors still work', async () => {
  const u = users();
  const created = await as(u.a).createGroupChat({ creator: member(u.a), members: [member(u.b), member(u.c)], name: 'Turma' });
  const id = created.id;
  await as(u.a).addGroupMembers({ chatId: id, actorId: u.a, members: [member(u.d)] });
  await as(u.a).setGroupAdmin(id, u.a, u.b, true);
  await as(u.a).setGroupAdmin(id, u.a, u.b, false);
  await as(u.a).updateGroupInfo({ chatId: id, actorId: u.a, name: 'Turma 2' });
  await as(u.a).removeGroupMember(id, u.a, u.d);
  await as(u.c).leaveGroupChat(id, u.c);
  await as(u.a).leaveGroupChat(id, u.a); // sole admin: admin_promoted + member_left
  const kinds = (await readMessages(id)).map((m) => m.system_event?.kind);
  for (const k of ['group_created', 'member_added', 'admin_promoted', 'admin_demoted', 'group_renamed', 'member_removed', 'member_left']) {
    assert.ok(kinds.includes(k), `missing ${k}`);
  }
  const chat = await readDoc(`chats/${id}`);
  assert.deepEqual(chat.user_ids, [u.b]);
  assert.deepEqual(chat.admin_ids, [u.b]);
});

// ---------------------------------------------------------------- (e) name validated on admin updates
const badNames = [
  ['61 characters', 'x'.repeat(61)],
  ['empty string', ''],
  ['null', null],
  ['a number', 123],
  ['a list', ['Nome']],
];
for (const [label, value] of badNames) {
  test(`HARDEN (e): admin raw update with name = ${label} is denied`, async () => {
    const u = users();
    const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a], name: 'Original' });
    await denied(updateDoc(chatRef(u.a, id), { name: value, updated_at: serverTimestamp() }));
    assert.equal((await readDoc(`chats/${id}`)).name, 'Original');
  });
}

test('HARDEN (e): name + membership change in one admin update is also validated', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a], name: 'Original' });
  await denied(updateDoc(chatRef(u.a, id), { name: 'x'.repeat(61), user_ids: [u.a, u.b, u.c], updated_at: serverTimestamp() }));
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.name, 'Original');
  assert.deepEqual(chat.user_ids, [u.a, u.b]);
});

test('HARDEN (e) control: 60 and 1 character names, avatar-only and membership updates are unaffected', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a], name: 'Original' });
  await updateDoc(chatRef(u.a, id), { name: 'y'.repeat(60), updated_at: serverTimestamp() });
  assert.equal((await readDoc(`chats/${id}`)).name.length, 60);
  await updateDoc(chatRef(u.a, id), { name: 'z', updated_at: serverTimestamp() });
  await updateDoc(chatRef(u.a, id), { avatar_url: 'http://x/e.png', updated_at: serverTimestamp() });
  await updateDoc(chatRef(u.a, id), { user_ids: [u.a, u.b, u.c], updated_at: serverTimestamp() });
  const chat = await readDoc(`chats/${id}`);
  assert.equal(chat.name, 'z');
  assert.equal(chat.avatar_url, 'http://x/e.png');
  assert.deepEqual(chat.user_ids, [u.a, u.b, u.c]);
});

test('HARDEN (e) control: updateGroupInfo rename through the real service still works', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a], name: 'Antigo' });
  await as(u.a).updateGroupInfo({ chatId: id, actorId: u.a, name: 'Renomeado' });
  assert.equal((await readDoc(`chats/${id}`)).name, 'Renomeado');
  assert.equal((await renamedEvents(id)).length, 1);
});

// ---------------------------------------------------------------- (f) direct chat shape
test('HARDEN (f): direct create with a non-null name is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}`), rawDirect(u.a, u.b, { name: 'Segredo' })));
  assert.equal(await readDoc(`chats/${u.a}_${u.b}`), null);
});

test('HARDEN (f): direct create with a non-null created_by is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}`), rawDirect(u.a, u.b, { created_by: u.a })));
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}`), rawDirect(u.a, u.b, { created_by: u.b })));
  assert.equal(await readDoc(`chats/${u.a}_${u.b}`), null);
});

test('HARDEN (f): direct create with participants missing a user_ids entry is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}`), rawDirect(u.a, u.b, { participants: { [u.a]: part(u.a) } })));
  await denied(setDoc(chatRef(u.a, `${u.a}_${u.b}`), rawDirect(u.a, u.b, { participants: {} })));
  assert.equal(await readDoc(`chats/${u.a}_${u.b}`), null);
});

test('HARDEN (f): direct create with an extra or foreign participants key is denied', async () => {
  const u = users();
  const id = `${u.a}_${u.b}`;
  await denied(setDoc(chatRef(u.a, id), rawDirect(u.a, u.b, { participants: { [u.a]: part(u.a), [u.b]: part(u.b), [u.c]: part(u.c) } })));
  await denied(setDoc(chatRef(u.a, id), rawDirect(u.a, u.b, { participants: { [u.a]: part(u.a), [u.c]: part(u.c) } })));
  assert.equal(await readDoc(`chats/${id}`), null);
});

test('HARDEN (f) control: canonical direct create (raw and via getOrCreateDirectChat) is still accepted', async () => {
  const u = users();
  await setDoc(chatRef(u.b, `${u.a}_${u.b}`), rawDirect(u.a, u.b));
  const stored = await readDoc(`chats/${u.a}_${u.b}`);
  assert.equal(stored.name, null);
  assert.equal(stored.created_by, null);
  assert.deepEqual(Object.keys(stored.participants).sort(), [u.a, u.b]);
  const chat = await as(u.d).getOrCreateDirectChat({ currentUser: member(u.d), otherUser: member(u.c) });
  assert.equal(chat.id, `${u.c}_${u.d}`);
  assert.equal((await readDoc(`chats/${chat.id}`)).created_by, null);
});

// ---------------------------------------------------------------- (g) no duplicate user_ids
test('HARDEN (g): group create with user_ids [a, a] is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `dup-${u.n}-1`), rawGroup(u.a, [u.a])));
  assert.equal(await readDoc(`chats/dup-${u.n}-1`), null);
});

test('HARDEN (g): group create with duplicates among 3+ user_ids is denied', async () => {
  const u = users();
  await denied(setDoc(chatRef(u.a, `dup-${u.n}-2`), rawGroup(u.a, [u.b, u.a])));
  await denied(setDoc(chatRef(u.a, `dup-${u.n}-3`), rawGroup(u.a, [u.b, u.b])));
  await denied(setDoc(chatRef(u.a, `dup-${u.n}-4`), rawGroup(u.a, [u.b, u.c, u.b])));
  for (const i of [2, 3, 4]) assert.equal(await readDoc(`chats/dup-${u.n}-${i}`), null);
});

test('HARDEN (g): an admin raw update that appends an already-present uid is denied', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await denied(updateDoc(chatRef(u.a, id), { user_ids: [u.a, u.b, u.b], updated_at: serverTimestamp() }));
  await denied(updateDoc(chatRef(u.a, id), { user_ids: [u.a, u.b, u.c, u.c], updated_at: serverTimestamp() }));
  await denied(updateDoc(chatRef(u.a, id), { user_ids: [u.a, u.b, u.a], updated_at: serverTimestamp() }));
  assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, [u.a, u.b]);
});

test('HARDEN (g) control: distinct user_ids on create and append, createGroupChat and addGroupMembers still work', async () => {
  const u = users();
  await setDoc(chatRef(u.a, `dup-${u.n}-ok`), rawGroup(u.a, [u.b, u.c]));
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await updateDoc(chatRef(u.a, id), { user_ids: [u.a, u.b, u.c], updated_at: serverTimestamp() });
  assert.deepEqual((await readDoc(`chats/${id}`)).user_ids, [u.a, u.b, u.c]);
  const chat = await as(u.a).createGroupChat({ creator: member(u.a), members: [member(u.b)], name: 'Dupla' });
  await as(u.a).addGroupMembers({ chatId: chat.id, actorId: u.a, members: [member(u.c), member(u.b)] }); // b already in: ignored
  assert.deepEqual((await readDoc(`chats/${chat.id}`)).user_ids, [u.a, u.b, u.c]);
});
