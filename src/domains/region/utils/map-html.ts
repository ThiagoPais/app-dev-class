import type { Coordinate, HeatPoint } from '../models/region.types';

interface MapHtmlOptions {
  name: string;
  center: Coordinate;
  zoom: number;
  /** Outline of the RA; skipped when it has fewer than three points. */
  boundary: Coordinate[];
  /** Renders Google Maps when set; falls back to OpenStreetMap otherwise. */
  googleMapsApiKey?: string;
}

/** Message the host sends to redraw the heat layer without reloading the map. */
export interface HeatMessage {
  type: 'heat';
  points: [number, number, number][];
  colors: string[];
}

const BOUNDARY_COLOR = '#E53935';

/** JSON that is safe inside an inline <script>: "</script>" in a value cannot close the tag. */
export function scriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function heatMessage(points: HeatPoint[], colors: string[]): HeatMessage {
  return {
    type: 'heat',
    points: points.map((p) => [p.latitude, p.longitude, p.weight]),
    colors,
  };
}

function boundaryTuples(boundary: Coordinate[]) {
  return boundary.length > 2 ? boundary.map((p) => [p.latitude, p.longitude]) : [];
}

/** Both map pages expose window.setHeat(message) and accept it through postMessage too. */
const MESSAGE_BRIDGE = `
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } }
    if (data && data.type === 'heat') window.setHeat(data);
  });`;

/** Google Maps JavaScript API page: marker, outline, and translucent circles as heat. */
function buildGoogleMapHtml({ name, center, zoom, boundary, googleMapsApiKey }: MapHtmlOptions) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body,#map{height:100%;margin:0}p{font:12px sans-serif;margin:12px;color:#832D51}</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = null, circles = [], pending = null;
  window.gm_authFailure = function () {
    document.body.innerHTML =
      '<p>Google Maps recusou a chave (API nao ativada, chave invalida ou restricao de referrer). Veja o console do navegador.</p>';
  };
  window.setHeat = function (message) {
    if (!map) { pending = message; return; }
    circles.forEach(function (circle) { circle.setMap(null); });
    var colors = message.colors, top = colors.length - 1;
    circles = message.points.map(function (p) {
      return new google.maps.Circle({
        map: map,
        center: { lat: p[0], lng: p[1] },
        radius: 120 + p[2] * 220,
        strokeWeight: 0,
        fillColor: colors[Math.round(p[2] * top)],
        fillOpacity: 0.18 + p[2] * 0.2,
        clickable: false
      });
    });
  };
  ${MESSAGE_BRIDGE}
  function initMap() {
    var center = { lat: ${center.latitude}, lng: ${center.longitude} };
    map = new google.maps.Map(document.getElementById('map'), {
      center: center,
      zoom: ${zoom},
      disableDefaultUI: true,
      gestureHandling: 'greedy'
    });
    var outline = ${scriptJson(boundaryTuples(boundary))};
    if (outline.length) {
      new google.maps.Polygon({
        map: map,
        paths: outline.map(function (p) { return { lat: p[0], lng: p[1] }; }),
        strokeColor: '${BOUNDARY_COLOR}',
        strokeWeight: 2,
        fillColor: '${BOUNDARY_COLOR}',
        fillOpacity: 0.08,
        clickable: false
      });
    }
    new google.maps.Marker({ position: center, map: map, title: ${scriptJson(name)} });
    if (pending) window.setHeat(pending);
  }
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    googleMapsApiKey ?? ''
  )}&callback=initMap"></script>
</body>
</html>`;
}

/**
 * Self-contained map page shown in an iframe on web and in a WebView on native when expo-maps is
 * unavailable: Google Maps when a key is configured, otherwise Leaflet with OpenStreetMap tiles
 * and Leaflet.heat for the heatmap. The page is built once per RA; heat changes arrive as
 * messages, so switching layers does not reload the tiles.
 */
export function buildMapHtml(options: MapHtmlOptions) {
  if (options.googleMapsApiKey) return buildGoogleMapHtml(options);

  const { name, center, zoom, boundary } = options;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<style>html,body,#map{height:100%;margin:0}</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([${center.latitude}, ${center.longitude}], ${zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map);
  var outline = ${scriptJson(boundaryTuples(boundary))};
  if (outline.length) {
    L.polygon(outline, {
      color: '${BOUNDARY_COLOR}',
      weight: 2,
      dashArray: '6 4',
      fillColor: '${BOUNDARY_COLOR}',
      fillOpacity: 0.08,
      interactive: false
    }).addTo(map);
  }
  L.marker([${center.latitude}, ${center.longitude}]).addTo(map).bindTooltip(${scriptJson(name)});

  var heat = null;
  window.setHeat = function (message) {
    if (heat) { map.removeLayer(heat); heat = null; }
    if (!message.points.length) return;
    var gradient = {}, colors = message.colors;
    colors.forEach(function (color, index) { gradient[(index + 1) / colors.length] = color; });
    // Dense layers would saturate at max 1; sparse hand-edited ones need it to stay visible.
    var max = Math.min(3, Math.max(1, message.points.length / 25));
    heat = L.heatLayer(message.points, {
      radius: 22,
      blur: 18,
      max: max,
      minOpacity: 0.25,
      maxZoom: ${zoom},
      gradient: gradient
    }).addTo(map);
  };
  ${MESSAGE_BRIDGE}
</script>
</body>
</html>`;
}

/** Map zoom that roughly fits a latitude span (in degrees) into the preview. */
export function zoomForDelta(latitudeDelta: number) {
  const zoom = Math.round(Math.log2(360 / Math.max(latitudeDelta, 0.001)));
  return Math.min(16, Math.max(10, zoom));
}
