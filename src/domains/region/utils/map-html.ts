import type { Coordinate } from '../models/region.types';
import type { HeatPoint } from './heat-points';

interface MapHtmlOptions {
  name: string;
  center: Coordinate;
  zoom: number;
  /** Outline of the RA; skipped when it has fewer than three points. */
  boundary: Coordinate[];
  heatPoints: HeatPoint[];
  showHeat: boolean;
  /** Renders Google Maps when set; falls back to OpenStreetMap otherwise. */
  googleMapsApiKey?: string;
}

const HEAT_COLORS = ['#F7C6D6', '#E96E97', '#B83A6B', '#832D51'];
const BOUNDARY_COLOR = '#E53935';

/** JSON that is safe inside an inline <script>: "</script>" in a name cannot close the tag. */
function scriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function heatTuples(points: HeatPoint[]) {
  return points.map((p) => [p.latitude, p.longitude, p.intensity]);
}

function boundaryTuples(boundary: Coordinate[]) {
  return boundary.length > 2 ? boundary.map((p) => [p.latitude, p.longitude]) : [];
}

/** Google Maps JavaScript API page: marker, outline, and overlapping translucent circles as heat. */
function buildGoogleMapHtml({
  name,
  center,
  zoom,
  boundary,
  heatPoints,
  showHeat,
  googleMapsApiKey,
}: MapHtmlOptions) {
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
  window.gm_authFailure = function () {
    document.body.innerHTML =
      '<p>Google Maps recusou a chave (API nao ativada, chave invalida ou restricao de referrer). Veja o console do navegador.</p>';
  };
  function initMap() {
    var center = { lat: ${center.latitude}, lng: ${center.longitude} };
    var map = new google.maps.Map(document.getElementById('map'), {
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
    if (${showHeat}) {
      var colors = ${scriptJson(HEAT_COLORS)};
      ${scriptJson(heatTuples(heatPoints))}.forEach(function (p) {
        var i = p[2];
        new google.maps.Circle({
          map: map,
          center: { lat: p[0], lng: p[1] },
          radius: 70 + i * 90,
          strokeWeight: 0,
          fillColor: colors[i > 0.75 ? 3 : i > 0.5 ? 2 : i > 0.3 ? 1 : 0],
          fillOpacity: 0.2,
          clickable: false
        });
      });
    }
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
 * unavailable: Google Maps when a key is configured, otherwise Leaflet with OpenStreetMap tiles.
 */
export function buildMapHtml(options: MapHtmlOptions) {
  if (options.googleMapsApiKey) return buildGoogleMapHtml(options);

  const { name, center, zoom, boundary, heatPoints, showHeat } = options;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<style>html,body,#map{height:100%;margin:0}.leaflet-heat-pane{filter:blur(9px)}</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
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
  if (${showHeat}) {
    // Own pane so the blur softens the heat circles but not the RA outline.
    map.createPane('heat').style.zIndex = 450;
    ${scriptJson(heatTuples(heatPoints))}.forEach(function (p) {
      var i = p[2];
      L.circle([p[0], p[1]], {
        pane: 'heat',
        radius: 70 + i * 90,
        stroke: false,
        fillColor: i > 0.75 ? '#832D51' : i > 0.5 ? '#B83A6B' : i > 0.3 ? '#E96E97' : '#F7C6D6',
        fillOpacity: 0.22,
        interactive: false
      }).addTo(map);
    });
  }
</script>
</body>
</html>`;
}

/** Map zoom that roughly fits a latitude span (in degrees) into the preview. */
export function zoomForDelta(latitudeDelta: number) {
  const zoom = Math.round(Math.log2(360 / Math.max(latitudeDelta, 0.001)));
  return Math.min(16, Math.max(10, zoom));
}
