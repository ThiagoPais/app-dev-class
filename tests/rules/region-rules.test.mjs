// Checks firestore.rules for the `regions` collection against the Firestore emulator:
// signed-in users read region pages, nobody writes them from the client.
// Usage: bun run test:region:rules
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

function client(uid) {
  const app = initializeApp({ projectId }, uid ?? 'anonymous');
  apps.push(app);
  const firestore = getFirestore(app, databaseId);
  connectFirestoreEmulator(
    firestore,
    host,
    Number(port),
    uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined
  );
  return firestore;
}

const denied = (promise) => assert.rejects(promise, (error) => error.code === 'permission-denied');

let alice;
let anonymous;

before(async () => {
  const url = `http://${host}:${port}/v1/projects/${projectId}/databases/${databaseId}/documents/regions/gama`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { name: { stringValue: 'Gama' } } }),
  });
  assert.ok(response.ok, `seed: ${response.status}`);
  const layer = await fetch(`${url}/heatmap_layers/popularidade`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { label: { stringValue: 'Popularidade' } } }),
  });
  assert.ok(layer.ok, `seed layer: ${layer.status}`);
  alice = client('alice');
  anonymous = client();
});

after(async () => {
  await Promise.all(apps.map(async (app) => {
    await terminate(getFirestore(app, databaseId));
    await deleteApp(app);
  }));
});

test('signed-in users can read a region page', async () => {
  const snapshot = await getDoc(doc(alice, 'regions', 'gama'));
  assert.equal(snapshot.data().name, 'Gama');
});

test('signed-out visitors cannot read region pages', async () => {
  await denied(getDoc(doc(anonymous, 'regions', 'gama')));
});

test('clients cannot create, edit, or delete region pages', async () => {
  await denied(setDoc(doc(alice, 'regions', 'nova'), { name: 'Nova' }));
  await denied(updateDoc(doc(alice, 'regions', 'gama'), { name: 'Outro' }));
  await denied(deleteDoc(doc(alice, 'regions', 'gama')));
});

test('signed-in users can read heatmap layers; clients cannot write them', async () => {
  const layer = doc(alice, 'regions', 'gama', 'heatmap_layers', 'popularidade');
  assert.equal((await getDoc(layer)).data().label, 'Popularidade');
  await denied(getDoc(doc(anonymous, 'regions', 'gama', 'heatmap_layers', 'popularidade')));
  await denied(setDoc(layer, { label: 'Outro' }));
  await denied(setDoc(doc(alice, 'regions', 'gama', 'heatmap_layers', 'nova'), { label: 'Nova' }));
});
