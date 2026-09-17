import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '@/services/firebase';

import type { UserProfile } from '../models/auth.types';

export interface CreateUserDTO {
  uid: string;
  email: string;
  fullName: string;
  cpf: string;
}

/**
 * Converts a Firestore Timestamp (or Date, or null) to a JS Date.
 */
function toDate(value: Timestamp | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value) return value.toDate();
  return new Date();
}

/**
 * Converts a Firestore user document snapshot into a typed UserProfile.
 */
function mapDocToUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  const providers = (data.authProviders as Record<string, Record<string, unknown>>) ?? {};

  const mapProvider = (p: Record<string, unknown> | undefined) => ({
    enabled: (p?.enabled as boolean) ?? false,
    linked: (p?.linked as boolean) ?? false,
    providerUid: (p?.providerUid as string | null) ?? null,
    email: (p?.email as string | null) ?? null,
    lastUsedAt: p?.lastUsedAt ? toDate(p.lastUsedAt as Timestamp) : null,
  });

  return {
    id,
    email: data.email as string,
    cpf: data.cpf as string,
    fullName: data.fullName as string,
    avatarUrl: (data.avatarUrl as string) ?? null,
    phoneNumber: (data.phoneNumber as string) ?? null,
    authProviders: {
      password: mapProvider(providers.password as Record<string, unknown>),
      google: mapProvider(providers.google as Record<string, unknown>),
      apple: mapProvider(providers.apple as Record<string, unknown>),
    },
    isActive: (data.isActive as boolean) ?? true,
    termsAcceptedAt: toDate(data.termsAcceptedAt as Timestamp),
    createdAt: toDate(data.createdAt as Timestamp),
    updatedAt: toDate(data.updatedAt as Timestamp),
  };
}

/**
 * Atomically creates a user profile and reserves their CPF in a transaction.
 * Throws if the CPF is already registered.
 */
export async function createUserWithCpf(dto: CreateUserDTO): Promise<UserProfile> {
  const { uid, email, fullName, cpf } = dto;

  const userRef = doc(db, 'users', uid);
  const cpfRef = doc(db, 'cpf_registry', cpf);

  const now = new Date();

  const userData = {
    email: email.trim().toLowerCase(),
    cpf,
    fullName: fullName.trim(),
    avatarUrl: null,
    phoneNumber: null,
    authProviders: {
      password: {
        enabled: true,
        linked: true,
        providerUid: null,
        email: email.trim().toLowerCase(),
        lastUsedAt: now,
      },
      google: {
        enabled: false,
        linked: false,
        providerUid: null,
        email: null,
        lastUsedAt: null,
      },
      apple: {
        enabled: false,
        linked: false,
        providerUid: null,
        email: null,
        lastUsedAt: null,
      },
    },
    isActive: true,
    termsAcceptedAt: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    const cpfSnap = await transaction.get(cpfRef);

    if (cpfSnap.exists()) {
      throw new Error('CPF_ALREADY_REGISTERED');
    }

    transaction.set(cpfRef, {
      userId: uid,
      registeredAt: serverTimestamp(),
    });

    transaction.set(userRef, userData);
  });

  return mapDocToUserProfile(uid, { ...userData, createdAt: now, updatedAt: now });
}

/**
 * Retrieves a user profile from Firestore by UID.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return null;

  return mapDocToUserProfile(uid, snap.data());
}

/**
 * Updates the lastUsedAt timestamp for a specific auth provider.
 */
export async function updateProviderLastUsed(
  uid: string,
  provider: 'password' | 'google' | 'apple'
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(
    userRef,
    {
      authProviders: {
        [provider]: { lastUsedAt: serverTimestamp() },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Retrieves the email associated with a CPF from cpf_registry and users collection.
 */
export async function getEmailByCpf(cpf: string): Promise<string | null> {
  const cpfRef = doc(db, 'cpf_registry', cpf);
  const cpfSnap = await getDoc(cpfRef);

  if (!cpfSnap.exists()) return null;

  const userId = cpfSnap.data()?.userId;
  if (!userId) return null;

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return null;

  return (userSnap.data()?.email as string) ?? null;
}
