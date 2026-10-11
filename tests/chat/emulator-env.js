import { mock } from 'bun:test';
import { initializeApp } from 'firebase/app';
import { collection, connectFirestoreEmulator, getDocsFromServer, getFirestore } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) {
  throw new Error('Run with the Firestore emulator and a demo- project: bun run test:chat:emulator');
}

const projectId = process.env.GCLOUD_PROJECT;
const databaseId = process.env.FIRESTORE_DATABASE_ID || 'app-db';
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');

export const app = initializeApp({ projectId }, 'chat-emulator');
export const db = getFirestore(app, databaseId);
connectFirestoreEmulator(db, host, Number(port));

/** Stand-in for the app's Firebase Auth instance; the service reads `auth.currentUser?.uid`. */
export const auth = { currentUser: null };
export function setCurrentUser(uid) {
  auth.currentUser = uid ? { uid } : null;
}

// Must run before chat.service.ts is imported (see loadChatService).
mock.module('../../src/services/firebase.ts', () => ({ app, db, auth }));

export async function loadChatService() {
  return import('../../src/domains/chat/services/chat.service.ts');
}

export async function clearDatabase() {
  const url = `http://${host}:${port}/emulator/v1/projects/${projectId}/databases/${databaseId}/documents`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Could not clear the emulator: ${response.status}`);
  // The REST delete bypasses the client, whose in-memory cache would otherwise replay the
  // previous test's documents as a stale first snapshot. Reconcile it with the server.
  await getDocsFromServer(collection(db, 'chats'));
}
