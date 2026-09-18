import type { User } from 'firebase/auth';

/**
 * Google sign-in on iOS/Android requires a native Google Sign-In library and a
 * development build (it cannot run in Expo Go). Until that is set up, only the
 * web popup flow is available.
 */
export async function promptGoogleSignIn(): Promise<User> {
  throw Object.assign(new Error('Google sign-in is only available on web'), {
    code: 'app/google-native-unavailable',
  });
}
