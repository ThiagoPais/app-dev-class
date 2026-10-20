import Constants from 'expo-constants';

/** Google Maps key exposed through app.config.js `extra`; undefined keeps the OpenStreetMap map. */
export const GOOGLE_MAPS_API_KEY: string | undefined =
  typeof Constants.expoConfig?.extra?.googleMapsApiKey === 'string' &&
  Constants.expoConfig.extra.googleMapsApiKey
    ? Constants.expoConfig.extra.googleMapsApiKey
    : undefined;
