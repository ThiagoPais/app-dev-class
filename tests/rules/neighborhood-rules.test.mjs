// Checks that firestore.rules let signed-in clients read the three neighborhood
// collections, refuse unauthenticated reads, and refuse every client write.
// Usage: bun run test:neighborhood:rules
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  setLogLevel,
  terminate,
  updateDoc,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT;
if (!process.env.FIRESTORE_EMULATOR_HOST || !projectId?.startsWith('demo-')) {
  throw new Error('Run inside `firebase emulators:exec` with a demo- project.');
}
setLogLevel('silent');

const databaseId = 'app-db';
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const apps = [];
const clients = {};

function client(name, uid) {
  const app = initializeApp({ projectId }, name);
  apps.push(app);
  const firestore = getFirestore(app, databaseId);
  const options = uid ? { mockUserToken: { sub: uid, user_id: uid } } : {};
  connectFirestoreEmulator(firestore, host, Number(port), options);
  return firestore;
}

const toValue = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toValue(v)])) } };
};

const docUrl = (path) =>
  `http://${host}:${port}/v1/projects/${projectId}/databases/${databaseId}/documents/${path}`;

/** Seeds a document through the emulator REST API, bypassing security rules. */
async function seed(path, data) {
  const response = await fetch(docUrl(path), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toValue(data).mapValue.fields }),
  });
  assert.ok(response.ok, `seed ${path}: ${response.status} ${await response.text()}`);
}

/** Reads the stored document through the REST API (rules bypassed); null when missing. */
async function stored(path) {
  const response = await fetch(docUrl(path), { headers: { Authorization: 'Bearer owner' } });
  if (response.status === 404) return null;
  assert.ok(response.ok, `read ${path}: ${response.status}`);
  const { fields } = await response.json();
  return fields;
}

const denied = (promise) => assert.rejects(promise, (error) => error.code === 'permission-denied');

const epoch = new Date(0);
const seeds = {
  neighborhoods: {
    id: 'n1',
    data: {
      state: 'SP', city: 'São Paulo', neighborhood: 'Vila Madalena',
      city_normalized: 'sao paulo', neighborhood_normalized: 'vila madalena',
      created_at: epoch, updated_at: epoch,
    },
    update: { neighborhood: 'Alterado' },
  },
  neighborhood_data: {
    id: 'n1',
    data: {
      name: 'Vila Madalena', name_normalized: 'vila madalena', tags: ['bairro'],
      description: null, mobility: null, residents_claims: [], household_income: null,
      security: null, location: null, created_at: epoch, updated_at: epoch,
    },
    update: { description: 'Alterado' },
  },
  neighborhood_locations: {
    id: 'SP',
    data: {
      state: 'SP',
      cities: [{ city: 'São Paulo', city_normalized: 'sao paulo', count: 1 }],
      updated_at: epoch,
    },
    update: { state: 'RJ' },
  },
};

before(async () => {
  clients.anon = client('anon');
  clients.alice = client('alice', 'alice');
  for (const [collectionName, { id, data }] of Object.entries(seeds)) {
    await seed(`${collectionName}/${id}`, data);
  }
});

after(async () => {
  await Promise.all(Object.values(clients).map(terminate));
  await Promise.all(apps.map(deleteApp));
});

for (const [collectionName, { id, data, update }] of Object.entries(seeds)) {
  const path = `${collectionName}/${id}`;

  test(`AC5/A3: ${collectionName}: an unauthenticated read is refused`, async () => {
    await denied(getDoc(doc(clients.anon, collectionName, id)));
  });

  test(`A3: ${collectionName}: a signed-in read is allowed`, async () => {
    const snapshot = await getDoc(doc(clients.alice, collectionName, id));
    assert.equal(snapshot.exists(), true);
    assert.equal(snapshot.data().state ?? snapshot.data().name, data.state ?? data.name);
  });

  test(`AC6/A4: ${collectionName}: a signed-in create is refused and nothing is stored`, async () => {
    await denied(setDoc(doc(clients.alice, collectionName, 'new-doc'), data));
    assert.equal(await stored(`${collectionName}/new-doc`), null);
  });

  test(`AC6/A4: ${collectionName}: a signed-in update is refused and the document is unchanged`, async () => {
    const before = await stored(path);
    await denied(updateDoc(doc(clients.alice, collectionName, id), update));
    assert.deepEqual(await stored(path), before);
  });

  test(`AC6/A4/E8: ${collectionName}: a signed-in delete is refused and the document remains`, async () => {
    const before = await stored(path);
    await denied(deleteDoc(doc(clients.alice, collectionName, id)));
    assert.deepEqual(await stored(path), before);
  });

  test(`E8: ${collectionName}: an unauthenticated write is refused`, async () => {
    await denied(setDoc(doc(clients.anon, collectionName, 'anon-doc'), data));
    await denied(deleteDoc(doc(clients.anon, collectionName, id)));
    assert.equal(await stored(`${collectionName}/anon-doc`), null);
  });
}
