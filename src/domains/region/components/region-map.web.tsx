import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useHeatmap } from '../hooks/use-heatmap';
import type { PopularityInfo, RegionLocation } from '../models/region.types';
import { buildMapHtml, zoomForDelta } from '../utils/map-html';
import { GOOGLE_MAPS_API_KEY } from '../utils/maps-key';
import { HeatmapToggle } from './heatmap-toggle';

interface RegionMapProps {
  name: string;
  location: RegionLocation;
  popularity: PopularityInfo | null;
}

/** Web version: expo-maps has no web support, so render Leaflet with OpenStreetMap tiles. */
export function RegionMap({ name, location, popularity }: RegionMapProps) {
  const { showHeat, toggleHeat, period, setPeriod, heatPoints } = useHeatmap(popularity);
  const { latitude, longitude, latitudeDelta, boundary } = location;
  const html = useMemo(
    () =>
      buildMapHtml({
        name,
        center: { latitude, longitude },
        zoom: zoomForDelta(latitudeDelta),
        boundary,
        heatPoints,
        showHeat,
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      }),
    [name, latitude, longitude, latitudeDelta, boundary, heatPoints, showHeat]
  );

  return (
    <View style={styles.container}>
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 0 }}
        title={`Mapa de ${name}`}
      />
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
});
