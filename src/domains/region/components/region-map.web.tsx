import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getHeatPoints, type HeatPeriod } from '../utils/heat-points';
import { buildMapHtml } from '../utils/map-html';
import { HeatmapToggle } from './heatmap-toggle';

interface RegionMapProps {
  city: string;
  coordinates: { latitude: number; longitude: number };
}

/** Web version: expo-maps has no web support, so render Leaflet with OpenStreetMap tiles. */
export function RegionMap({ city, coordinates }: RegionMapProps) {
  const [showHeat, setShowHeat] = useState(false);
  const [period, setPeriod] = useState<HeatPeriod>('noite');
  const html = useMemo(
    () =>
      buildMapHtml({ city, coordinates, heatPoints: getHeatPoints(coordinates, period), showHeat }),
    [city, coordinates, period, showHeat]
  );

  return (
    <View style={styles.container}>
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 0 }}
        title={`Mapa de ${city}`}
      />
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
});
