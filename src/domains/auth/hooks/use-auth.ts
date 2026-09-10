import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '../context/auth-context';

/**
 * Hook to access the authentication state and actions.
 * Must be used within an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an <AuthProvider>. ' +
      'Wrap your app root layout with <AuthProvider>.'
    );
  }

  return context;
}
