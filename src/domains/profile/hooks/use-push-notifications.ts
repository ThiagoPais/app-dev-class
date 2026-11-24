import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/domains/auth';
import { db } from '@/services/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerPushToken(uid: string) {
  // Remote push only works on physical devices with a dev/production build.
  if (Platform.OS === 'web' || !Device.isDevice) return;

  // Android 13+ only shows the permission prompt after a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await updateDoc(doc(db, 'users', uid), { expo_push_tokens: arrayUnion(token) });
}

/** Registers this device for push and opens the chat when a notification is tapped. */
export function usePushNotifications() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!uid) return;
    registerPushToken(uid).catch((error) => console.warn('[push] register failed', error));
  }, [uid]);

  useEffect(() => {
    const userId = response?.notification.request.content.data?.userId;
    if (typeof userId === 'string') router.push(`/chat/${userId}`);
  }, [response]);
}
