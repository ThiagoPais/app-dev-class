import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';

import { auth } from '@/services/firebase';

/**
 * Opens the Google account picker in a popup and signs the user in to Firebase Auth.
 */
export async function promptGoogleSignIn(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // Auth is created with initializeAuth, so the popup resolver must be passed explicitly
  const credential = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  return credential.user;
}
