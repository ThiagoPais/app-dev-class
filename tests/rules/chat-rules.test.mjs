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
/** Fresh, sortable uids for one test (a < b < c < d < e < m), so doc ids never collide between tests. */
function users() {
  const n = ++counter;
  const make = (p) => `${p}${n}x`;
  return { a: make('a'), b: make('b'), c: make('c'), d: make('d'), e: make('e'), m: make('m'), n };
}
const part = (uid) => ({ full_name: `Name ${uid}`, avatar_url: null });
const profile = (uid) => ({ fullName: `Name ${uid}`, avatarUrl: null });
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

test('system messages: forged actor, null-author text and authored system are denied; own actor accepted', async () => {
  const u = users();
  const id = await seedGroup(u, { members: [u.a, u.b], admins: [u.a] });
  await setDoc(newMsgRef(u.b, id), rawSystem(id, u.b)); // control: actor is the writer
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
