export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export interface SignupFormValues {
  name: string;
  email: string;
  password: string;
  agreeToTerms: boolean;
}

export interface SignupFormErrors {
  name?: string;
  email?: string;
  password?: string;
  agreeToTerms?: string;
}

export type SocialAuthProvider = 'apple' | 'google';
