/** Half-width of the visible area, in degrees (about 2 km). */
const SPAN = 0.02;

/** Key-less OpenStreetMap embed centred on the point, with a marker. */
export function getOpenStreetMapUrl({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const bbox = [longitude - SPAN, latitude - SPAN, longitude + SPAN, latitude + SPAN].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
}
