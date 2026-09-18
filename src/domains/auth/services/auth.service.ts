import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword as firebaseSignIn,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';

import { auth } from '@/services/firebase';
import { sanitizeCpf } from '@/shared/utils/cpf';

import type {
  CompleteProfileFormValues,
  GoogleAccount,
  GoogleSignInResult,
  LoginFormValues,
  SignupFormValues,
  UserProfile,
} from '../models/auth.types';
import { promptGoogleSignIn } from './google-sign-in';
import {
  createUserWithCpf,
  getUserProfile,
  linkGoogleProvider,
  updateProviderLastUsed,
} from './user.service';

/**
 * Maps Firebase Auth error codes to user-friendly Portuguese messages.
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
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela do Google. Permita pop-ups e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Este e-mail já está cadastrado com outro método de login. Entre com e-mail e senha.';
    case 'auth/operation-not-allowed':
      return 'Este método de login não está habilitado.';
    case 'auth/unauthorized-domain':
      return 'Este domínio não está autorizado para login com Google.';
    case 'app/google-native-unavailable':
      return 'O login com Google ainda não está disponível no celular. Use a versão web.';
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
  const { email, password } = values;

  let userCredential;
  try {
    userCredential = await firebaseSignIn(
      auth,
      email.trim().toLowerCase(),
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
 * Google serves profile photos at 96px by default; request a larger version
 * so the avatar stays sharp on high-density screens.
 */
function toLargeGooglePhoto(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/=s\d+-c$/, '=s400-c');
}

/**
 * Extracts the Google account details (name, e-mail, photo) from a Firebase user.
 */
export function getGoogleAccount(user: User): GoogleAccount {
  const google = user.providerData.find((p) => p.providerId === 'google.com');

  return {
    providerUid: google?.uid ?? null,
    email: (google?.email ?? user.email ?? '').trim().toLowerCase(),
    fullName: google?.displayName ?? user.displayName ?? '',
    avatarUrl: toLargeGooglePhoto(google?.photoURL ?? user.photoURL),
  };
}

/**
 * Signs in with Google. Existing profiles get the Google provider linked and,
 * if they have no avatar yet, the Google photo. New users have no profile yet
 * and must complete signup with their CPF.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  let user: User;
  try {
    user = await promptGoogleSignIn();
  } catch (error: unknown) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { status: 'cancelled' };
    }
    throw new Error(mapAuthError(code));
  }

  const profile = await getUserProfile(user.uid);

  if (!profile) {
    return { status: 'needs-profile' };
  }

  if (!profile.isActive) {
    await firebaseSignOut(auth);
    throw new Error('Esta conta foi desativada.');
  }

  const { google } = profile.authProviders;
  if (google.linked && !google.enabled) {
    await firebaseSignOut(auth);
    throw new Error('Este método de login foi desativado nas configurações da sua conta.');
  }

  const account = getGoogleAccount(user);
  const newAvatarUrl = profile.avatarUrl ? null : account.avatarUrl;

  await linkGoogleProvider(user.uid, {
    providerUid: account.providerUid,
    email: account.email,
    avatarUrl: newAvatarUrl,
  });

  return {
    status: 'signed-in',
    profile: {
      ...profile,
      avatarUrl: profile.avatarUrl ?? newAvatarUrl,
      authProviders: {
        ...profile.authProviders,
        google: {
          enabled: true,
          linked: true,
          providerUid: account.providerUid,
          email: account.email,
          lastUsedAt: new Date(),
        },
      },
    },
  };
}

/**
 * Creates the Firestore profile for a user who signed in with Google but has
 * no profile yet, reserving their CPF and saving the Google photo as avatar.
 */
export async function completeGoogleSignup(
  values: CompleteProfileFormValues
): Promise<UserProfile> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Sua sessão expirou. Entre com o Google novamente.');
  }

  const account = getGoogleAccount(user);

  try {
    return await createUserWithCpf({
      uid: user.uid,
      email: account.email,
      fullName: values.name.trim(),
      cpf: sanitizeCpf(values.cpf),
      provider: 'google',
      providerUid: account.providerUid,
      avatarUrl: account.avatarUrl,
    });
  } catch (error: unknown) {
    // Keep the Google session so the user can fix the CPF and try again
    const message = error instanceof Error ? error.message : '';
    if (message === 'CPF_ALREADY_REGISTERED') {
      throw new Error('Este CPF já está cadastrado.');
    }
    throw new Error('Erro ao criar conta. Tente novamente.');
  }
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
