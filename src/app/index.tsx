import { Redirect } from 'expo-router';
import { useAuth } from '@/domains/auth';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (user) {
    return <Redirect href="/(logged)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
