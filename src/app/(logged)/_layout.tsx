import { Stack } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function LoggedLayout() {
  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
