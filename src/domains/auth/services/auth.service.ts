import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignIn,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Unsubscribe,
  type User,
} from 'firebase/auth';

import { auth } from '@/services/firebase';
import { sanitizeCpf } from '@/shared/utils/cpf';

import type { LoginFormValues, SignupFormValues, UserProfile } from '../models/auth.types';
import {
  createUserWithCpf,
  getEmailByCpf,
  getUserProfile,
  updateProviderLastUsed,
} from './user.service';

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado.';
    case 'auth/invalid-email':
      return 'O e-mail informado é inválido.';
    case 'auth/weak-password':
      return 'A senha deve ter no mínimo 6 caracteres.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/network-request-failed':
      return 'Erro de conexão. Verifique sua internet.';
    default:
      return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}

/**
 * Registers a new user with email/password and creates their Firestore profile
 * with an atomically-reserved CPF.
 */
export async function signUp(values: SignupFormValues): Promise<UserProfile> {
  const { email, password, name, cpf } = values;
  const sanitizedCpf = sanitizeCpf(cpf);

  // 1. Create Firebase Auth account
  let userCredential;
  try {
    userCredential = await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    throw new Error(mapAuthError(firebaseError.code ?? ''));
  }

  // 2. Create Firestore profile + CPF reservation (atomic transaction)
  try {
    const profile = await createUserWithCpf({
      uid: userCredential.user.uid,
      email: email.trim().toLowerCase(),
      fullName: name.trim(),
      cpf: sanitizedCpf,
    });
    return profile;
  } catch (error: unknown) {
    // If Firestore fails, delete the Auth account to keep consistent state
    try {
      await userCredential.user.delete();
    } catch {
      // Swallow cleanup errors
    }

    const message = error instanceof Error ? error.message : '';
    if (message === 'CPF_ALREADY_REGISTERED') {
      throw new Error('Este CPF já está cadastrado.');
    }
    throw new Error('Erro ao criar conta. Tente novamente.');
  }
}

/**
 * Signs in an existing user with email and password.
 * Verifies that the password provider is enabled in Firestore.
 */
export async function signIn(values: LoginFormValues): Promise<UserProfile> {
  const { email: identifier, password } = values;
  const trimmed = identifier.trim();

  let emailToAuth = trimmed.toLowerCase();

  if (!trimmed.includes('@') && /^\d{11}$/.test(trimmed)) {
    const foundEmail = await getEmailByCpf(trimmed);
    if (!foundEmail) {
      throw new Error('CPF não encontrado.');
    }
    emailToAuth = foundEmail.toLowerCase();
  }

  let userCredential;
  try {
    userCredential = await firebaseSignIn(
      auth,
      emailToAuth,
      password
    );
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    throw new Error(mapAuthError(firebaseError.code ?? ''));
  }

  // Load user profile from Firestore
  const profile = await getUserProfile(userCredential.user.uid);

  if (!profile) {
    throw new Error('Perfil não encontrado. Entre em contato com o suporte.');
  }

  if (!profile.isActive) {
    await firebaseSignOut(auth);
    throw new Error('Esta conta foi desativada.');
  }

  if (!profile.authProviders.password.enabled) {
    await firebaseSignOut(auth);
    throw new Error('Este método de login foi desativado nas configurações da sua conta.');
  }

  // Update last used timestamp for the password provider
  await updateProviderLastUsed(userCredential.user.uid, 'password');

  return profile;
}

/**
 * Signs the current user out of Firebase Auth.
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribes to Firebase Auth state changes.
 * Returns an unsubscribe function.
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
