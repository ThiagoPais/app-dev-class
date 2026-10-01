// Runs the real forum.service.ts writes against the Firestore emulator to check
// that firestore.rules accept honest votes/replies and reject forged counters.
// Usage: see README in this folder.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
  terminate,
  updateDoc,
  writeBatch,
  setLogLevel,
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

function client(uid) {
  const app = initializeApp({ projectId }, uid);
  apps.push(app);
  const firestore = getFirestore(app, databaseId);
  connectFirestoreEmulator(firestore, host, Number(port), { mockUserToken: { sub: uid, user_id: uid } });
  return firestore;
}

/** Seeds a document through the emulator REST API, bypassing security rules. */
async function seed(path, data) {
  const toValue = (value) => {
    if (value === null) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return { integerValue: String(value) };
    if (typeof value === 'string') return { stringValue: value };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toValue(v)])) } };
  };
  const url = `http://${host}:${port}/v1/projects/${projectId}/databases/${databaseId}/documents/${path}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toValue(data).mapValue.fields }),
  });
  assert.ok(response.ok, `seed ${path}: ${response.status} ${await response.text()}`);
}

const denied = (promise) => assert.rejects(promise, (error) => error.code === 'permission-denied');

const topicData = (overrides = {}) => ({
  author_id: 'alice',
  author_snapshot: { full_name: 'Alice', avatar_url: null },
  title: 'Tópico de teste',
  content: 'Conteúdo do tópico',
  region: 'DF',
  city: 'Plano Piloto',
  city_normalized: 'plano piloto',
  upvotes_count: 0,
  downvotes_count: 0,
  net_votes: 0,
  replies_count: 0,
  is_pinned: false,
  is_locked: false,
  is_deleted: false,
  last_reply_at: new Date(0),
  created_at: new Date(0),
  updated_at: new Date(0),
  ...overrides,
});

let service;
const as = (uid) => {
  useClient(clients[uid], uid);
  return service;
};
const counts = async (path) => {
  const data = (await getDoc(doc(clients.alice, path))).data();
  return [data.upvotes_count ?? data.replies_count, data.downvotes_count, data.net_votes];
};

before(async () => {
  clients.alice = client('alice');
  clients.bob = client('bob');
  service = await import('../../src/domains/forum/services/forum.service.ts');

  await seed('users/alice', { fullName: 'Alice', avatarUrl: null, isActive: true });
  await seed('users/bob', { fullName: 'Bob', avatarUrl: null, isActive: true });
  await seed('forum_topics/topic', topicData());
  await seed('forum_topics/locked', topicData({ is_locked: true }));
});

after(async () => {
  await Promise.all(Object.values(clients).map(terminate));
  await Promise.all(apps.map(deleteApp));
});

test('topic votes toggle, switch and count several users', async () => {
  const path = 'forum_topics/topic';
  await as('alice').castTopicVote('topic', 'alice', 'up');
  assert.deepEqual(await counts(path), [1, 0, 1]);
  await as('alice').castTopicVote('topic', 'alice', 'up');
  assert.deepEqual(await counts(path), [0, 0, 0]);
  await as('alice').castTopicVote('topic', 'alice', 'down');
  assert.deepEqual(await counts(path), [0, 1, -1]);
  await as('alice').castTopicVote('topic', 'alice', 'up');
  assert.deepEqual(await counts(path), [1, 0, 1]);
  await as('bob').castTopicVote('topic', 'bob', 'up');
  assert.deepEqual(await counts(path), [2, 0, 2]);
  assert.equal(await as('bob').getUserTopicVote('topic', 'bob'), 'up');
});

test('clients cannot forge topic counters or votes', async () => {
  const topicRef = doc(clients.bob, 'forum_topics', 'topic');
  for (const changes of [
    { net_votes: 1000000 },
    { upvotes_count: increment(1), net_votes: increment(1) },
    { replies_count: -100 },
    { replies_count: increment(1), last_reply_at: serverTimestamp(), last_reply_id: 'ghost' },
    { last_reply_at: serverTimestamp() },
    { is_pinned: true },
  ]) {
    await denied(updateDoc(topicRef, changes));
  }

  // A vote without the counter change, and a counter change bigger than the vote.
  await denied(setDoc(doc(clients.bob, 'forum_topics', 'topic', 'votes', 'bob'), { vote_type: 'down', created_at: serverTimestamp() }));
  const batch = writeBatch(clients.bob);
  batch.update(doc(clients.bob, 'forum_topics', 'topic', 'votes', 'bob'), { vote_type: 'down', created_at: serverTimestamp() });
  batch.update(topicRef, { upvotes_count: increment(-1), downvotes_count: increment(5), net_votes: increment(-6) });
  await denied(batch.commit());

  // Someone else's vote document.
  const other = writeBatch(clients.bob);
  other.delete(doc(clients.bob, 'forum_topics', 'topic', 'votes', 'alice'));
  other.update(topicRef, { upvotes_count: increment(-1), net_votes: increment(-1) });
  await denied(other.commit());
});

test('replies increment the topic once and need a matching author', async () => {
  const before = (await getDoc(doc(clients.alice, 'forum_topics', 'topic'))).data().replies_count;
  const reply = await as('bob').createForumMessage({
    topicId: 'topic',
    authorId: 'bob',
    authorSnapshot: { fullName: 'Bob', avatarUrl: null },
    content: 'Primeira resposta',
  });
  const topic = (await getDoc(doc(clients.alice, 'forum_topics', 'topic'))).data();
  assert.equal(topic.replies_count, before + 1);
  assert.equal(topic.last_reply_id, reply.id);

  await assert.rejects(
    as('bob').createForumMessage({
      topicId: 'topic',
      authorId: 'bob',
      authorSnapshot: { fullName: 'Alice', avatarUrl: null },
      content: 'Fingindo ser outra pessoa',
    })
  );

  // A reply written without bumping the counter.
  const lonely = doc(collection(clients.bob, 'forum_topics', 'topic', 'messages'));
  await denied(
    setDoc(lonely, {
      topic_id: 'topic', author_id: 'bob', author_snapshot: { full_name: 'Bob', avatar_url: null },
      content: 'Sem contador', upvotes_count: 0, downvotes_count: 0, net_votes: 0, is_deleted: false,
      created_at: serverTimestamp(), updated_at: serverTimestamp(),
    })
  );
});

test('locked topics reject replies', async () => {
  await assert.rejects(
    as('bob').createForumMessage({
      topicId: 'locked',
      authorId: 'bob',
      authorSnapshot: { fullName: 'Bob', avatarUrl: null },
      content: 'Trancado',
    })
  );
});

test('only the author removes a reply, and the counter drops once', async () => {
  const reply = await as('alice').createForumMessage({
    topicId: 'topic',
    authorId: 'alice',
    authorSnapshot: { fullName: 'Alice', avatarUrl: null },
    content: 'Vou apagar',
  });
  const repliesBefore = (await getDoc(doc(clients.alice, 'forum_topics', 'topic'))).data().replies_count;

  await assert.rejects(as('bob').softDeleteForumMessage('topic', reply.id));

  await as('alice').softDeleteForumMessage('topic', reply.id);
  await as('alice').softDeleteForumMessage('topic', reply.id);
  const topicRef = doc(clients.alice, 'forum_topics', 'topic');
  assert.equal((await getDoc(topicRef)).data().replies_count, repliesBefore - 1);

  // Decrementing again by pointing at an already removed reply.
  await denied(updateDoc(topicRef, { replies_count: increment(-1), last_removed_reply_id: reply.id }));
});

test('reply votes toggle and cannot be forged', async () => {
  const reply = await as('alice').createForumMessage({
    topicId: 'topic',
    authorId: 'alice',
    authorSnapshot: { fullName: 'Alice', avatarUrl: null },
    content: 'Votem aqui',
  });
  const path = `forum_topics/topic/messages/${reply.id}`;
  await as('bob').castMessageVote('topic', reply.id, 'bob', 'down');
  assert.deepEqual(await counts(path), [0, 1, -1]);
  await as('bob').castMessageVote('topic', reply.id, 'bob', 'down');
  assert.deepEqual(await counts(path), [0, 0, 0]);
  await denied(updateDoc(doc(clients.bob, path), { net_votes: 50 }));
});

test('authors still edit topics and replies directly', async () => {
  await updateDoc(doc(clients.alice, 'forum_topics', 'topic'), { title: 'Novo título', updated_at: serverTimestamp() });
  await denied(updateDoc(doc(clients.bob, 'forum_topics', 'topic'), { title: 'Sequestro', updated_at: serverTimestamp() }));
});
