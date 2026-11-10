import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useHeatmap } from '../hooks/use-heatmap';
import type { PopularityInfo, RegionLocation } from '../models/region.types';
import { buildMapHtml, zoomForDelta } from '../utils/map-html';
import { GOOGLE_MAPS_API_KEY } from '../utils/maps-key';
import { HeatmapToggle } from './heatmap-toggle';

type MapsModule = typeof import('expo-maps');

/**
 * expo-maps ships native code, so importing it throws in Expo Go or in a dev
 * build made before it was installed. Load it lazily and fall back to an OpenStreetMap WebView.
 * Android's Google Maps SDK draws a blank map without an API key, so it also falls back then.
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
  name: string;
  location: RegionLocation;
  popularity: PopularityInfo | null;
}

/** Circle radius (metres) and base colour of the native heat approximation. */
const HEAT_RADIUS = 110;
const HEAT_COLOR = [233, 110, 151];
const BOUNDARY_COLOR = '#E53935';

/** Map centred on the RA with its outline and a popularity heatmap toggle. */
export function RegionMap({ name, location, popularity }: RegionMapProps) {
  const { showHeat, toggleHeat, period, setPeriod, heatPoints } = useHeatmap(popularity);
  const { latitude, longitude, latitudeDelta, boundary } = location;
  const center = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  const zoom = zoomForDelta(latitudeDelta);
  const useNative =
    maps !== null &&
    (Platform.OS === 'ios' || (Platform.OS === 'android' && Boolean(GOOGLE_MAPS_API_KEY)));

  const html = useMemo(
    () =>
      useNative
        ? ''
        : buildMapHtml({
            name,
            center,
            zoom,
            boundary,
            heatPoints,
            showHeat,
            googleMapsApiKey: GOOGLE_MAPS_API_KEY,
          }),
    [useNative, name, center, zoom, boundary, heatPoints, showHeat]
  );

  // expo-maps has no heatmap layer: overlapping translucent circles give a similar look.
  const circles = heatPoints.map((point, index) => ({
    id: `heat-${index}`,
    center: { latitude: point.latitude, longitude: point.longitude },
    radius: HEAT_RADIUS * (0.6 + point.intensity * 0.6),
    color: `rgba(${HEAT_COLOR.join(',')}, ${(0.08 + point.intensity * 0.1).toFixed(2)})`,
  }));

  const polygons =
    boundary.length > 2
      ? [
          {
            id: 'boundary',
            coordinates: boundary,
            color: 'rgba(229, 57, 53, 0.08)',
            lineColor: BOUNDARY_COLOR,
            lineWidth: 2,
          },
        ]
      : [];

  const mapProps = {
    cameraPosition: { coordinates: center, zoom },
    circles,
    polygons,
    markers: [{ id: name, coordinates: center, title: name }],
    style: styles.fill,
  };

  return (
    <View style={styles.container}>
      {maps && Platform.OS === 'ios' ? (
        <maps.AppleMaps.View {...mapProps} />
      ) : maps && useNative ? (
        <maps.GoogleMaps.View {...mapProps} />
      ) : (
        <WebView
          accessibilityLabel={`Mapa de ${name}`}
          originWhitelist={['*']}
          source={{ html }}
          style={styles.fill}
        />
      )}
      {popularity ? (
        <HeatmapToggle
          active={showHeat}
          onToggle={toggleHeat}
          period={period}
          onPeriodChange={setPeriod}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    overflow: 'hidden',
    borderRadius: 12,
  },
  fill: {
    flex: 1,
  },
});
