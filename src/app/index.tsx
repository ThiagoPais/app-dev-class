import { Redirect } from 'expo-router';

import { useAuth } from '@/domains/auth';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Redirect
      href={user ? '/(logged)/(tabs)/landingPage' : '/(auth)/login'}
    />
  );
}
