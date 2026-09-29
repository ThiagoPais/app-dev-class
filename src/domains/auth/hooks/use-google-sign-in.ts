import { useState } from 'react';
import { router } from 'expo-router';

import { useAuth } from './use-auth';

/**
 * Runs the Google sign-in flow and navigates based on the result:
 * existing users go to the app, new users go to complete their profile.
 */
export function useGoogleSignIn() {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);

    try {
      setIsLoading(true);
      const result = await loginWithGoogle();

      if (result.status === 'signed-in') {
        router.replace('/(logged)/(tabs)/landingPage');
      } else if (result.status === 'needs-profile') {
        router.push('/complete-profile');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar com o Google. Tente novamente.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInWithGoogle,
    isLoading,
    error,
  };
}
