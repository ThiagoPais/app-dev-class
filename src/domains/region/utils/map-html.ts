import type { Coordinates } from '../constants';
import type { HeatPoint } from './heat-points';

interface MapHtmlOptions {
  city: string;
  coordinates: Coordinates;
  heatPoints: HeatPoint[];
  showHeat: boolean;
  /** Renders Google Maps when set; falls back to OpenStreetMap otherwise. */
  googleMapsApiKey?: string;
}

const HEAT_COLORS = ['#F7C6D6', '#E96E97', '#B83A6B', '#832D51'];

/** Google Maps JavaScript API page: marker plus overlapping translucent circles as heat. */
function buildGoogleMapHtml({
  city,
  coordinates,
  heatPoints,
  showHeat,
  googleMapsApiKey,
}: MapHtmlOptions) {
  const heat = heatPoints.map((p) => [p.latitude, p.longitude, p.intensity]);

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
    var center = { lat: ${coordinates.latitude}, lng: ${coordinates.longitude} };
    var map = new google.maps.Map(document.getElementById('map'), {
      center: center,
      zoom: 14,
      disableDefaultUI: true,
      gestureHandling: 'greedy'
    });
    new google.maps.Marker({ position: center, map: map, title: ${JSON.stringify(city)} });
    if (${showHeat}) {
      var colors = ${JSON.stringify(HEAT_COLORS)};
      ${JSON.stringify(heat)}.forEach(function (p) {
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

  const { city, coordinates, heatPoints, showHeat } = options;
  const heat = heatPoints.map((p) => [p.latitude, p.longitude, p.intensity]);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<style>html,body,#map{height:100%;margin:0}.leaflet-overlay-pane{filter:blur(9px)}</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([${coordinates.latitude}, ${coordinates.longitude}], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map);
  L.marker([${coordinates.latitude}, ${coordinates.longitude}]).addTo(map).bindTooltip(${JSON.stringify(city)});
  if (${showHeat}) {
    var group = L.layerGroup().addTo(map);
    ${JSON.stringify(heat)}.forEach(function (p) {
      var i = p[2];
      L.circle([p[0], p[1]], {
        radius: 70 + i * 90,
        stroke: false,
        fillColor: i > 0.75 ? '#832D51' : i > 0.5 ? '#B83A6B' : i > 0.3 ? '#E96E97' : '#F7C6D6',
        fillOpacity: 0.22
      }).addTo(group);
    });
  }
</script>
</body>
</html>`;
}
