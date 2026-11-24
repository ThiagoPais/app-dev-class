import { Stack } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthGuard } from '@/domains/auth/components';
import { usePushNotifications } from '@/domains/profile';

export default function LoggedLayout() {
  usePushNotifications();

  return (
    <AuthGuard>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthGuard>
  );
}
