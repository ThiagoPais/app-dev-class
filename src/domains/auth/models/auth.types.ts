export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export interface SignupFormValues {
  name: string;
  email: string;
  cpf: string;
  password: string;
  agreeToTerms: boolean;
}

export interface SignupFormErrors {
  name?: string;
  email?: string;
  cpf?: string;
  password?: string;
  agreeToTerms?: string;
  general?: string;
}

export interface CompleteProfileFormValues {
  name: string;
  cpf: string;
  agreeToTerms: boolean;
}

export interface CompleteProfileFormErrors {
  name?: string;
  cpf?: string;
  agreeToTerms?: string;
  general?: string;
}

export type SocialAuthProvider = 'apple' | 'google';

export interface GoogleAccount {
  providerUid: string | null;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export type GoogleSignInResult =
  | { status: 'signed-in'; profile: UserProfile }
  | { status: 'needs-profile' }
  | { status: 'cancelled' };

export type AuthProviderType = 'password' | 'google.com' | 'apple.com';

export interface AuthProviderConfig {
  enabled: boolean;
  linked: boolean;
  providerUid?: string | null;
  email?: string | null;
  lastUsedAt?: Date | null;
}

export interface UserProfile {
  id: string;
  email: string;
  cpf: string;
  fullName: string;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  authProviders: {
    password: AuthProviderConfig;
    google: AuthProviderConfig;
    apple: AuthProviderConfig;
  };
  isActive: boolean;
  termsAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
