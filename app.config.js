module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      firebaseApiKey:
        process.env.FIREBASE_API_KEY ||
        process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain:
        process.env.FIREBASE_AUTH_DOMAIN ||
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId:
        process.env.FIREBASE_PROJECT_ID ||
        process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId:
        process.env.FIREBASE_MESSAGING_SENDER_ID ||
        process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId:
        process.env.FIREBASE_APP_ID ||
        process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firestoreDbName:
        process.env.FIRESTORE_DB_NAME ||
        process.env.EXPO_PUBLIC_FIRESTORE_DB_NAME,
    },
  };
};
