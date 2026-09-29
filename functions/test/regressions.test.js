const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createRequire } = require('node:module');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const clientRequire = createRequire(require.resolve('../../package.json'));
const { initializeApp, deleteApp } = clientRequire('firebase/app');
const { connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore: clientFirestore, query, collection, where, orderBy, setDoc, updateDoc, serverTimestamp, terminate, setLogLevel } = clientRequire('firebase/firestore');
const { connectAuthEmulator, getAuth: clientAuth, signInWithCustomToken } = clientRequire('firebase/auth');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) {
  throw new Error('Run against Firestore and Auth emulators with a demo- project. See functions/README.md.');
}
const handlers = require('../index');
setLogLevel('silent');
const databaseId = process.env.FIRESTORE_DATABASE_ID || 'app-db';
const db = getFirestore(databaseId);
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT, apiKey: 'demo-key' }, 'regression-tests');
const apps = [app];
const clients = [];
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
function client(uid) {
  const instance = initializeApp({ projectId: process.env.GCLOUD_PROJECT }, uid || 'anonymous');
  apps.push(instance);
  const firestore = clientFirestore(instance, databaseId);
  connectFirestoreEmulator(firestore, host, Number(port), uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
  clients.push(firestore);
  return firestore;
}
const alice = client('alice');
const bob = client('bob');
const anonymous = client();
const topicRef = db.doc('forum_topics/regression-topic');
const request = (data, uid = 'alice') => ({ data, auth: uid ? { uid } : undefined });
const denied = (promise) => assert.rejects(promise, { code: 'permission-denied' });
const topicData = () => ({
  author_id: 'alice', author_snapshot: { full_name: 'Alice', avatar_url: null }, title: 'A topic', content: 'Topic content',
  region: 'DF', city: 'Plano Piloto', city_normalized: 'plano piloto', upvotes_count: 0, downvotes_count: 0, net_votes: 0,
  replies_count: 0, is_pinned: false, is_locked: false, is_deleted: false,
  last_reply_at: Timestamp.now(), created_at: Timestamp.now(), updated_at: Timestamp.now(),
});

before(async () => {
  // Tests can be rerun against the same emulator without retaining earlier votes.
  await db.recursiveDelete(topicRef);
  await db.doc('forum_topics/valid-topic').delete();
  await db.doc('users/alice').set({ fullName: 'Alice', avatarUrl: null, isActive: true });
  await db.doc('users/bob').set({ fullName: 'Bob', avatarUrl: null, isActive: true });
  await topicRef.set(topicData());
});

test('missing topics and replies return empty snapshots', async () => {
  assert.equal((await getDoc(doc(bob, 'forum_topics', 'missing-topic'))).exists(), false);
  assert.equal((await getDoc(doc(bob, 'forum_topics', topicRef.id, 'messages', 'missing-reply'))).exists(), false);
});
after(async () => {
  await Promise.all(clients.map(terminate));
  await Promise.all(apps.map(deleteApp));
  await db.terminate();
});

test('private profiles and CPF mappings are unavailable before login', async () => {
  await db.doc('cpf_registry/52998224725').set({ userId: 'alice' });
  await denied(getDoc(doc(anonymous, 'cpf_registry', '52998224725')));
  await denied(getDoc(doc(anonymous, 'users', 'alice')));
  await denied(getDoc(doc(bob, 'users', 'alice')));
  // Authenticated signup can still check CPF uniqueness.
  assert.equal((await getDoc(doc(bob, 'cpf_registry', '52998224725'))).exists(), true);
});

test('clients cannot forge counters, activity timestamps, votes or pinned status', async () => {
  for (const firestore of [alice, bob]) {
    for (const changes of [{ net_votes: 1000000 }, { replies_count: -100 }, { upvotes_count: 3 }, { downvotes_count: 3 }, { last_reply_at: serverTimestamp() }, { is_pinned: true }]) {
      await denied(updateDoc(doc(firestore, 'forum_topics', topicRef.id), changes));
    }
    await denied(setDoc(doc(firestore, 'forum_topics', topicRef.id, 'votes', firestore === alice ? 'alice' : 'bob'), { vote_type: 'up' }));
  }
});

test('topics start with zero counters and cannot be forged as pinned', async () => {
  const valid = { ...topicData(), created_at: serverTimestamp(), updated_at: serverTimestamp(), last_reply_at: serverTimestamp() };
  await setDoc(doc(alice, 'forum_topics', 'valid-topic'), valid);
  await denied(setDoc(doc(alice, 'forum_topics', 'forged-topic'), { ...valid, net_votes: 100 }));
  await denied(setDoc(doc(alice, 'forum_topics', 'pinned-topic'), { ...valid, is_pinned: true }));
});

test('owners can edit topics while other users cannot', async () => {
  await updateDoc(doc(alice, 'forum_topics', topicRef.id), { title: 'Updated topic', updated_at: serverTimestamp() });
  await denied(updateDoc(doc(bob, 'forum_topics', topicRef.id), { title: 'Hijacked', updated_at: serverTimestamp() }));
});

test('topic vote toggle and switch keep counts consistent', async () => {
  const vote = (voteType) => handlers.castForumVote.run(request({ topicId: topicRef.id, voteType }));
  for (const [type, counts] of [['up', [1, 0, 1]], ['down', [0, 1, -1]], ['down', [0, 0, 0]], ['up', [1, 0, 1]], ['up', [0, 0, 0]]]) {
    await vote(type);
    const data = (await topicRef.get()).data();
    assert.deepEqual([data.upvotes_count, data.downvotes_count, data.net_votes], counts);
  }
  await assert.rejects(handlers.castForumVote.run(request({ topicId: topicRef.id, voteType: 'invalid' })), { code: 'invalid-argument' });
});

test('concurrent votes from different users are both counted', async () => {
  await Promise.all(['alice', 'bob'].map(uid => handlers.castForumVote.run(request({ topicId: topicRef.id, voteType: 'up' }, uid))));
  assert.equal((await topicRef.get()).data().upvotes_count, 2);
});

test('callables require authentication and reject invalid document paths', async () => {
  for (const handler of [handlers.createForumMessage, handlers.deleteForumMessage, handlers.castForumVote]) {
    await assert.rejects(handler.run(request({}, null)), { code: 'unauthenticated' });
    await assert.rejects(handler.run(request({ topicId: 'topic/messages/other' })), { code: 'invalid-argument' });
  }
});

test('reply creation increments counters and derives author from the session', async () => {
  const message = await handlers.createForumMessage.run(request({ topicId: topicRef.id, content: '  First reply  ', authorId: 'bob' }));
  assert.equal(message.author_id, 'alice');
  assert.equal(message.author_snapshot.full_name, 'Alice');
  assert.equal(message.content, 'First reply');
  assert.equal((await topicRef.get()).data().replies_count, 1);
  assert.equal((await getDoc(doc(bob, 'forum_topics', topicRef.id, 'messages', message.id))).data().content, 'First reply');
  await denied(updateDoc(doc(bob, 'forum_topics', topicRef.id, 'messages', message.id), { net_votes: 999 }));
  await denied(updateDoc(doc(alice, 'forum_topics', topicRef.id, 'messages', message.id), { upvotes_count: 999 }));
  await denied(setDoc(doc(bob, 'forum_topics', topicRef.id, 'messages', 'direct-write'), { author_id: 'bob', content: 'Reply' }));
  await updateDoc(doc(alice, 'forum_topics', topicRef.id, 'messages', message.id), { content: 'Edited reply', updated_at: serverTimestamp() });
  await denied(updateDoc(doc(bob, 'forum_topics', topicRef.id, 'messages', message.id), { content: 'Hijacked', updated_at: serverTimestamp() }));
  await handlers.castForumVote.run(request({ topicId: topicRef.id, messageId: message.id, voteType: 'up' }, 'bob'));
  assert.equal((await topicRef.collection('messages').doc(message.id).get()).data().net_votes, 1);
});

test('only the author can delete a reply; concurrent retries decrement once', async () => {
  const [message] = (await topicRef.collection('messages').get()).docs;
  const data = { topicId: topicRef.id, messageId: message.id };
  await assert.rejects(handlers.deleteForumMessage.run(request(data, 'bob')), { code: 'permission-denied' });
  await Promise.all([handlers.deleteForumMessage.run(request(data)), handlers.deleteForumMessage.run(request(data))]);
  assert.equal((await topicRef.get()).data().replies_count, 0);
  await denied(getDoc(doc(bob, 'forum_topics', topicRef.id, 'messages', message.id)));
  await denied(getDoc(doc(alice, 'forum_topics', topicRef.id, 'messages', message.id)));
  await assert.rejects(handlers.castForumVote.run(request({ ...data, voteType: 'up' })), { code: 'not-found' });
  const visible = await getDocs(query(collection(bob, 'forum_topics', topicRef.id, 'messages'), where('is_deleted', '==', false), orderBy('created_at', 'asc')));
  assert.equal(visible.size, 0);
});

test('locked topics reject replies; deleted topics reject reply reads and mutations', async () => {
  await topicRef.update({ is_locked: true });
  await assert.rejects(handlers.createForumMessage.run(request({ topicId: topicRef.id, content: 'Reply' })), { code: 'failed-precondition' });
  await topicRef.update({ is_locked: false });
  const reply = await handlers.createForumMessage.run(request({ topicId: topicRef.id, content: 'Visible reply' }));
  await updateDoc(doc(alice, 'forum_topics', topicRef.id), { is_deleted: true, updated_at: serverTimestamp() });
  await denied(getDoc(doc(bob, 'forum_topics', topicRef.id)));
  await denied(getDoc(doc(bob, 'forum_topics', topicRef.id, 'messages', reply.id)));
  await denied(updateDoc(doc(alice, 'forum_topics', topicRef.id, 'messages', reply.id), { content: 'After deletion', updated_at: serverTimestamp() }));
  await assert.rejects(handlers.createForumMessage.run(request({ topicId: topicRef.id, content: 'After deletion' })), { code: 'not-found' });
  await assert.rejects(handlers.castForumVote.run(request({ topicId: topicRef.id, voteType: 'up' })), { code: 'not-found' });
});

test('CPF login verifies the password and returns a working session without exposing email', async () => {
  const auth = getAuth();
  const user = await auth.createUser({ email: `cpf-regression-${Date.now()}@example.test`, password: 'correct-password' });
  await db.doc(`users/${user.uid}`).set({ email: user.email, isActive: true, authProviders: { password: { enabled: true } } });
  await db.doc('cpf_registry/11144477735').set({ userId: user.uid });
  const data = { cpf: '11144477735', password: 'correct-password' };
  await assert.rejects(handlers.signInWithCpf.run(request({ ...data, password: 'wrong-password' }, null)), { code: 'unauthenticated' });
  await assert.rejects(handlers.signInWithCpf.run(request({ ...data, cpf: '00000000000' }, null)), { code: 'unauthenticated' });
  const result = await handlers.signInWithCpf.run(request(data, null));
  assert.deepEqual(Object.keys(result), ['customToken']);
  const session = clientAuth(app);
  connectAuthEmulator(session, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const credential = await signInWithCustomToken(session, result.customToken);
  assert.equal(credential.user.uid, user.uid);
  await db.doc(`users/${user.uid}`).update({ isActive: false });
  await assert.rejects(handlers.signInWithCpf.run(request(data, null)), { code: 'unauthenticated' });
  await db.doc(`users/${user.uid}`).update({ isActive: true, 'authProviders.password.enabled': false });
  await assert.rejects(handlers.signInWithCpf.run(request(data, null)), { code: 'unauthenticated' });
  await auth.deleteUser(user.uid);
});
