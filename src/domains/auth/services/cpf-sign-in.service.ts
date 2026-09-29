import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { app, auth } from '@/services/firebase';

export async function signInWithCpf(cpf: string, password: string) {
  const signIn = httpsCallable<{ cpf: string; password: string }, { customToken: string }>(
    getFunctions(app),
    'signInWithCpf'
  );
  const { data } = await signIn({ cpf, password });
  return signInWithCustomToken(auth, data.customToken);
}
