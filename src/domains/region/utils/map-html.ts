import type { Coordinates } from '../constants';
import type { HeatPoint } from './heat-points';

interface MapHtmlOptions {
  city: string;
  coordinates: Coordinates;
  heatPoints: HeatPoint[];
  showHeat: boolean;
}

/**
 * Self-contained Leaflet page (OpenStreetMap tiles, optional blurred heat layer) shown in an
 * iframe on web and in a WebView on native when expo-maps is unavailable.
 */
export function buildMapHtml({ city, coordinates, heatPoints, showHeat }: MapHtmlOptions) {
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
