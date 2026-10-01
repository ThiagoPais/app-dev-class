// Stand-in for src/services/firebase.ts; the test swaps `db` and the signed-in user.
export const auth = { currentUser: null };
export let db = null;

export function useClient(firestore, uid) {
  db = firestore;
  auth.currentUser = { uid };
}
