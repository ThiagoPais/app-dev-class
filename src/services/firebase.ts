import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  // @ts-ignore: getReactNativePersistence exists at runtime via Metro's react-native condition
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAGpRVdyEoTemCAfAQVrjeFERnm8DccC-M',
  authDomain: 'app-dev-class-c3f1e.firebaseapp.com',
  projectId: 'app-dev-class-c3f1e',
  storageBucket: 'app-dev-class-c3f1e.firebasestorage.app',
  messagingSenderId: '619335754245',
  appId: '1:619335754245:web:24f1f816ff17bf12e4b26c',
};

// Avoid re-initializing Firebase App during Fast Refresh / Hot Reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with cross-platform persistence & Fast Refresh guard
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence:
      Platform.OS === 'web'
        ? browserLocalPersistence
        : getReactNativePersistence(AsyncStorage),
  });
} catch {
  // If Fast Refresh runs again, return the existing initialized instance
  auth = getAuth(app);
}

const db: Firestore = getFirestore(app, 'app-db');

export { app, auth, db };
