import { useAuth } from '@/domains/auth';
import { Redirect } from 'expo-router';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (user) {
    return <Redirect href="/(logged)/(tabs)/landingPage" />;
  }

  return <Redirect href="/(auth)/login" />;
}
