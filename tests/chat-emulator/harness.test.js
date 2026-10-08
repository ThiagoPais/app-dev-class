import { beforeEach, expect, test } from 'bun:test';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, clearDatabase, db, setCurrentUser } from '../chat/emulator-env.js';

beforeEach(clearDatabase);

test('writes and reads through the emulator database', async () => {
  await setDoc(doc(db, 'chats', 'c1'), { type: 'direct' });
  expect((await getDoc(doc(db, 'chats', 'c1'))).data()).toEqual({ type: 'direct' });
});

test('clearDatabase removes documents between tests', async () => {
  expect((await getDoc(doc(db, 'chats', 'c1'))).exists()).toBe(false);
});

test('setCurrentUser controls auth.currentUser', () => {
  setCurrentUser('alice');
  expect(auth.currentUser?.uid).toBe('alice');
  setCurrentUser(null);
  expect(auth.currentUser).toBeNull();
});
