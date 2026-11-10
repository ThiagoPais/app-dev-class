import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { HeatPoint, RegionLocation } from '../models/region.types';
import { buildMapHtml, heatMessage, zoomForDelta } from '../utils/map-html';
import { GOOGLE_MAPS_API_KEY } from '../utils/maps-key';

export interface RegionMapProps {
  name: string;
  location: RegionLocation;
  /** Heat points to draw; empty hides the heat layer. */
  points: HeatPoint[];
  colors: string[];
}

/** Web version: expo-maps has no web support, so render Leaflet with OpenStreetMap tiles. */
export function RegionMap({ name, location, points, colors }: RegionMapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { latitude, longitude, latitudeDelta, boundary } = location;
  const html = useMemo(
    () =>
      buildMapHtml({
        name,
        center: { latitude, longitude },
        zoom: zoomForDelta(latitudeDelta),
        boundary,
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      }),
    [name, latitude, longitude, latitudeDelta, boundary]
  );
  const message = useMemo(() => heatMessage(points, colors), [points, colors]);

  const send = () => frame.current?.contentWindow?.postMessage(message, '*');
  // Redraw the heat when it changes; the initial draw happens in onLoad.
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(message, '*');
  }, [message]);

  return (
    <View style={styles.container}>
      <iframe
        onLoad={send}
        ref={frame}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 0 }}
        title={`Mapa de ${name}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
});
