import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';

import type { LoginFormValues, SignupFormValues, UserProfile } from '../models/auth.types';
import {
  signIn,
  signUp,
  signOutUser,
  subscribeToAuthState,
} from '../services/auth.service';
import { getUserProfile } from '../services/user.service';

export interface AuthContextValue {
  /** The current user profile from Firestore, or null if not authenticated */
  user: UserProfile | null;
  /** The raw Firebase Auth user, or null */
  firebaseUser: User | null;
  /** True while the initial auth state is being resolved */
  isLoading: boolean;
  /** Sign in with email and password */
  login: (values: LoginFormValues) => Promise<void>;
  /** Create a new account with email, password, and CPF */
  signup: (values: SignupFormValues) => Promise<void>;
  /** Sign the current user out */
  logout: () => Promise<void>;
  /** Reload the current profile from Firestore */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          const profile = await getUserProfile(fbUser.uid);
          setUser(profile);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (values: LoginFormValues) => {
    const profile = await signIn(values);
    setUser(profile);
  }, []);

  const signup = useCallback(async (values: SignupFormValues) => {
    const profile = await signUp(values);
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!firebaseUser) {
      setUser(null);
      return;
    }

    const profile = await getUserProfile(firebaseUser.uid);
    setUser(profile);
  }, [firebaseUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      firebaseUser,
      isLoading,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [user, firebaseUser, isLoading, login, signup, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
