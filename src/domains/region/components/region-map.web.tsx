import { StyleSheet, View } from 'react-native';

import { getOpenStreetMapUrl } from '../utils/map-url';

interface RegionMapProps {
  city: string;
  coordinates: { latitude: number; longitude: number };
}

/** Web version: expo-maps has no web support, so embed OpenStreetMap, which needs no key. */
export function RegionMap({ city, coordinates }: RegionMapProps) {
  return (
    <View style={styles.container}>
      <iframe
        loading="lazy"
        src={getOpenStreetMapUrl(coordinates)}
        style={{ width: '100%', height: '100%', border: 0 }}
        title={`Mapa de ${city}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 140,
    overflow: 'hidden',
    borderRadius: 12,
  },
});
