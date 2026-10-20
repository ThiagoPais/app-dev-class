import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getOpenStreetMapUrl } from '../utils/map-url';

type MapsModule = typeof import('expo-maps');

/**
 * expo-maps ships native code, so importing it throws in Expo Go or in a dev
 * build made before it was installed. Load it lazily and fall back to an OpenStreetMap WebView.
 */
function loadMaps(): MapsModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-maps') as MapsModule;
  } catch {
    return null;
  }
}

const maps = loadMaps();

interface RegionMapProps {
  city: string;
  coordinates: { latitude: number; longitude: number };
}

/** Static map centred on the RA; falls back to OpenStreetMap where expo-maps is unavailable. */
export function RegionMap({ city, coordinates }: RegionMapProps) {
  const mapProps = {
    cameraPosition: { coordinates, zoom: 13 },
    markers: [{ id: city, coordinates, title: city }],
    style: styles.fill,
  };

  return (
    <View style={styles.container}>
      {maps && Platform.OS === 'ios' ? (
        <maps.AppleMaps.View {...mapProps} />
      ) : maps && Platform.OS === 'android' ? (
        <maps.GoogleMaps.View {...mapProps} />
      ) : (
        <WebView
          accessibilityLabel={`Mapa de ${city}`}
          source={{ uri: getOpenStreetMapUrl(coordinates) }}
          style={styles.fill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 140,
    overflow: 'hidden',
    borderRadius: 12,
  },
  fill: {
    flex: 1,
  },
});
