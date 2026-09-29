const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore, Timestamp } = require('firebase-admin/firestore');
const { defineString } = require('firebase-functions/params');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();
const databaseId = defineString('FIRESTORE_DATABASE_ID', { default: 'app-db' });
const apiKey = defineString('AUTH_WEB_API_KEY');
const db = () => getFirestore(databaseId.value());

function requireUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  return request.auth.uid;
}

function documentId(value) {
  if (typeof value !== 'string' || !value || value.includes('/') || value.length > 1500) {
    throw new HttpsError('invalid-argument', 'Identificador inválido.');
  }
  return value;
}

function requireTopic(snapshot) {
  if (!snapshot.exists || snapshot.data().is_deleted) {
    throw new HttpsError('not-found', 'Este tópico foi removido.');
  }
  return snapshot.data();
}

exports.signInWithCpf = onCall(async (request) => {
  const { cpf, password } = request.data ?? {};
  const invalid = () => new HttpsError('unauthenticated', 'CPF ou senha incorretos.');
  if (typeof cpf !== 'string' || !/^\d{11}$/.test(cpf) || typeof password !== 'string' || !password) {
    throw invalid();
  }

  const registry = await db().doc(`cpf_registry/${cpf}`).get();
  if (!registry.exists) throw invalid();
  const uid = registry.data().userId;
  if (typeof uid !== 'string' || !uid || uid.includes('/')) throw invalid();
  const profile = await db().doc(`users/${uid}`).get();
  const user = profile.data();
  if (!user || user.isActive !== true || user.authProviders?.password?.enabled !== true) throw invalid();

  // Verify the password with Firebase Auth before issuing any session token.
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const endpoint = host
    ? `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
    : 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
  let response;
  try {
    response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey.value())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password, returnSecureToken: true }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new HttpsError('unavailable', 'Erro de conexão. Tente novamente.');
  }
  const result = await response.json();
  if (!response.ok) {
    if (result.error?.message?.startsWith('TOO_MANY_ATTEMPTS_TRY_LATER')) {
      throw new HttpsError('resource-exhausted', 'Muitas tentativas. Tente novamente mais tarde.');
    }
    throw invalid();
  }
  if (result.localId !== uid) throw invalid();
  return { customToken: await getAuth().createCustomToken(uid) };
});

exports.createForumMessage = onCall(async (request) => {
  const uid = requireUser(request);
  const topicId = documentId(request.data?.topicId);
  const content = request.data?.content;
  if (typeof content !== 'string' || !content.trim() || content.trim().length > 2000) {
    throw new HttpsError('invalid-argument', 'Escreva uma resposta de até 2000 caracteres.');
  }
  const topicRef = db().doc(`forum_topics/${topicId}`);
  const messageRef = topicRef.collection('messages').doc();
  const author = await db().doc(`users/${uid}`).get();
  if (!author.exists || !author.data().isActive) {
    throw new HttpsError('permission-denied', 'Perfil indisponível.');
  }
  const now = Timestamp.now();
  const message = {
    topic_id: topicId,
    author_id: uid,
    author_snapshot: { full_name: author.data().fullName, avatar_url: author.data().avatarUrl ?? null },
    content: content.trim(),
    upvotes_count: 0,
    downvotes_count: 0,
    net_votes: 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  await db().runTransaction(async (transaction) => {
    const topic = requireTopic(await transaction.get(topicRef));
    if (topic.is_locked) throw new HttpsError('failed-precondition', 'Este tópico está trancado.');
    transaction.create(messageRef, message);
    transaction.update(topicRef, { replies_count: FieldValue.increment(1), last_reply_at: FieldValue.serverTimestamp() });
  });
  return { id: messageRef.id, ...message, created_at: now.toMillis(), updated_at: now.toMillis() };
});

exports.deleteForumMessage = onCall(async (request) => {
  const uid = requireUser(request);
  const topicId = documentId(request.data?.topicId);
  const messageId = documentId(request.data?.messageId);
  const topicRef = db().doc(`forum_topics/${topicId}`);
  const messageRef = topicRef.collection('messages').doc(messageId);
  await db().runTransaction(async (transaction) => {
    const [topicSnap, messageSnap] = await transaction.getAll(topicRef, messageRef);
    requireTopic(topicSnap);
    if (!messageSnap.exists) return;
    const message = messageSnap.data();
    if (message.author_id !== uid) throw new HttpsError('permission-denied', 'Esta resposta pertence a outra pessoa.');
    if (message.is_deleted) return;
    transaction.update(messageRef, { is_deleted: true, updated_at: FieldValue.serverTimestamp() });
    transaction.update(topicRef, { replies_count: FieldValue.increment(-1) });
  });
  return { deleted: true };
});

exports.castForumVote = onCall(async (request) => {
  const uid = requireUser(request);
  const topicId = documentId(request.data?.topicId);
  const messageId = request.data?.messageId;
  const voteType = request.data?.voteType;
  if (voteType !== 'up' && voteType !== 'down') {
    throw new HttpsError('invalid-argument', 'Voto inválido.');
  }
  const topicRef = db().doc(`forum_topics/${topicId}`);
  const itemRef = messageId === undefined ? topicRef : topicRef.collection('messages').doc(documentId(messageId));
  const voteRef = itemRef.collection('votes').doc(uid);
  await db().runTransaction(async (transaction) => {
    const [topicSnap, itemSnap, voteSnap] = await transaction.getAll(topicRef, itemRef, voteRef);
    requireTopic(topicSnap);
    if (!itemSnap.exists || itemSnap.data().is_deleted) throw new HttpsError('not-found', 'Conteúdo removido.');
    const previous = voteSnap.exists ? voteSnap.data().vote_type : null;
    const next = previous === voteType ? null : voteType;
    const up = Number(next === 'up') - Number(previous === 'up');
    const down = Number(next === 'down') - Number(previous === 'down');
    if (next === null) transaction.delete(voteRef);
    else transaction.set(voteRef, { vote_type: next, created_at: FieldValue.serverTimestamp() });
    transaction.update(itemRef, {
      upvotes_count: FieldValue.increment(up),
      downvotes_count: FieldValue.increment(down),
      net_votes: FieldValue.increment(up - down),
    });
  });
  return { voted: true };
});
