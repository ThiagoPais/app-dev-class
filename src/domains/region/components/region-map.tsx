import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getHeatPoints, type HeatPeriod } from '../utils/heat-points';
import { buildMapHtml } from '../utils/map-html';
import { HeatmapToggle } from './heatmap-toggle';

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

/** Circle radius (metres) and base colour of the native heat approximation. */
const HEAT_RADIUS = 110;
const HEAT_COLOR = [233, 110, 151];

/** Map centred on the RA with a popularity heatmap toggle; OpenStreetMap where expo-maps is missing. */
export function RegionMap({ city, coordinates }: RegionMapProps) {
  const [showHeat, setShowHeat] = useState(false);
  const [period, setPeriod] = useState<HeatPeriod>('noite');
  const heatPoints = useMemo(() => getHeatPoints(coordinates, period), [coordinates, period]);
  const html = useMemo(
    () => buildMapHtml({ city, coordinates, heatPoints, showHeat }),
    [city, coordinates, heatPoints, showHeat]
  );

  // expo-maps has no heatmap layer: overlapping translucent circles give a similar look.
  const circles = showHeat
    ? heatPoints.map((point, index) => ({
        id: `heat-${index}`,
        center: { latitude: point.latitude, longitude: point.longitude },
        radius: HEAT_RADIUS * (0.6 + point.intensity * 0.6),
        color: `rgba(${HEAT_COLOR.join(',')}, ${(0.08 + point.intensity * 0.1).toFixed(2)})`,
      }))
    : [];

  const mapProps = {
    cameraPosition: { coordinates, zoom: 13 },
    circles,
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
          originWhitelist={['*']}
          source={{ html }}
          style={styles.fill}
        />
      )}
      <HeatmapToggle
        active={showHeat}
        onToggle={() => setShowHeat((current) => !current)}
        period={period}
        onPeriodChange={setPeriod}
      />
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
