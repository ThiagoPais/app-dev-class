import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import type { HeatPoint, RegionLocation } from '../models/region.types';
import { buildMapHtml, heatMessage, scriptJson, zoomForDelta } from '../utils/map-html';
import { GOOGLE_MAPS_API_KEY } from '../utils/maps-key';

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
const useNativeMap =
  maps !== null &&
  (Platform.OS === 'ios' || (Platform.OS === 'android' && Boolean(GOOGLE_MAPS_API_KEY)));

export interface RegionMapProps {
  name: string;
  location: RegionLocation;
  /** Heat points to draw; empty hides the heat layer. */
  points: HeatPoint[];
  colors: string[];
}

const BOUNDARY_COLOR = '#E53935';

function hexToRgba(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha.toFixed(2)})`;
}

/** Map of the RA with its outline and heat points. */
export function RegionMap(props: RegionMapProps) {
  return useNativeMap && maps ? <NativeMap maps={maps} {...props} /> : <WebMap {...props} />;
}

/** expo-maps has no heatmap layer: overlapping translucent circles give a similar look. */
function NativeMap({ maps: mapsModule, name, location, points, colors }: RegionMapProps & { maps: MapsModule }) {
  const { latitude, longitude, latitudeDelta, boundary } = location;
  const center = { latitude, longitude };
  const top = colors.length - 1;

  const props = {
    cameraPosition: { coordinates: center, zoom: zoomForDelta(latitudeDelta) },
    circles: points.map((point, index) => ({
      id: `heat-${index}`,
      center: { latitude: point.latitude, longitude: point.longitude },
      radius: 120 + point.weight * 220,
      color: hexToRgba(colors[Math.round(point.weight * top)], 0.18 + point.weight * 0.2),
    })),
    polygons:
      boundary.length > 2
        ? [
            {
              id: 'boundary',
              coordinates: boundary,
              color: hexToRgba(BOUNDARY_COLOR, 0.08),
              lineColor: BOUNDARY_COLOR,
              lineWidth: 2,
            },
          ]
        : [],
    markers: [{ id: name, coordinates: center, title: name }],
    style: styles.fill,
  };

  return Platform.OS === 'ios' ? (
    <mapsModule.AppleMaps.View {...props} />
  ) : (
    <mapsModule.GoogleMaps.View {...props} />
  );
}

/** Leaflet page in a WebView; heat changes are injected without reloading the tiles. */
function WebMap({ name, location, points, colors }: RegionMapProps) {
  const webView = useRef<WebView>(null);
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
  const script = `window.setHeat(${scriptJson(heatMessage(points, colors))}); true;`;

  const send = () => webView.current?.injectJavaScript(script);
  // Redraw the heat when it changes; the initial draw happens in onLoadEnd.
  useEffect(() => {
    webView.current?.injectJavaScript(script);
  }, [script]);

  return (
    <WebView
      accessibilityLabel={`Mapa de ${name}`}
      onLoadEnd={send}
      originWhitelist={['*']}
      ref={webView}
      source={{ html }}
      style={styles.fill}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
