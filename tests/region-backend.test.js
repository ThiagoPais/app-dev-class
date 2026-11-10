import { expect, test } from 'bun:test';

import { buildRegionDocuments } from '../scripts/seed-regions.mjs';
import { FORUM_CITIES } from '../src/domains/forum/constants/regions.ts';
import regionList from '../src/domains/region/constants/regions.json';
import { getHeatPoints, HEAT_PERIODS } from '../src/domains/region/utils/heat-points.ts';
import { buildMapHtml, zoomForDelta } from '../src/domains/region/utils/map-html.ts';
import { parseRegionDocument } from '../src/domains/region/utils/parse-region.ts';
import { slugify } from '../src/shared/utils/slugify.ts';

const documents = buildRegionDocuments();

test('every forum RA has a region page reachable by slug', () => {
  const slugs = new Set(regionList.map((region) => region.slug));
  for (const city of FORUM_CITIES) expect(slugs.has(slugify(city))).toBe(true);
});

test('region slugs match their names and are unique', () => {
  const slugs = regionList.map((region) => region.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const region of regionList) expect(region.slug).toBe(slugify(region.name));
});

test('every seeded document parses into a page with a map and heatmap', () => {
  expect(Object.keys(documents)).toHaveLength(regionList.length);
  for (const [slug, data] of Object.entries(documents)) {
    const region = parseRegionDocument(slug, data);
    expect(region).not.toBeNull();
    expect(region.location.latitude).toBeLessThan(-15);
    expect(region.location.longitude).toBeLessThan(-47);
    expect(region.popularity).not.toBeNull();
    expect(FORUM_CITIES).toContain(region.forumCity);
  }
});

test('regions with detail files get their indicator cards', () => {
  const asaNorte = parseRegionDocument('asa-norte', documents['asa-norte']);
  expect(asaNorte.forumCity).toBe('Plano Piloto');
  expect(asaNorte.location.boundary.length).toBeGreaterThan(2);
  expect(asaNorte.income.ranking.some((entry) => entry.region === 'Asa Norte')).toBe(true);

  const nucleo = parseRegionDocument('nucleo-bandeirante', documents['nucleo-bandeirante']);
  expect(nucleo.safety.occurrences.length).toBeGreaterThan(0);
  expect(nucleo.income.ranking.some((entry) => entry.region === 'Núcleo Bandeirante')).toBe(true);

  const gama = parseRegionDocument('gama', documents.gama);
  expect(gama.mobility).toBeNull();
  expect(gama.photos).toEqual([]);
});

test('parseRegionDocument rejects documents without a name or location', () => {
  expect(parseRegionDocument('x', undefined)).toBeNull();
  expect(parseRegionDocument('x', { name: 'X' })).toBeNull();
  expect(parseRegionDocument('x', { location: { latitude: 1, longitude: 2 } })).toBeNull();
  const minimal = parseRegionDocument('x', { name: 'X', location: { latitude: 1, longitude: 2 } });
  expect(minimal.forumCity).toBe('X');
  expect(minimal.location.boundary).toEqual([]);
  expect(minimal.popularity).toBeNull();
});

test('heat points follow the period activity levels', () => {
  const { popularity } = documents.gama;
  const counts = HEAT_PERIODS.map((period) => getHeatPoints(popularity, period.id).length);
  const night = counts[HEAT_PERIODS.findIndex((period) => period.id === 'noite')];
  expect(Math.max(...counts)).toBe(night);
  for (const point of getHeatPoints(popularity, 'noite')) {
    expect(point.intensity).toBeGreaterThan(0);
    expect(point.intensity).toBeLessThanOrEqual(1);
  }
});

test('map HTML escapes names so they cannot close the inline script', () => {
  const html = buildMapHtml({
    name: '</script><script>alert(1)</script>',
    center: { latitude: -15.8, longitude: -47.9 },
    zoom: 14,
    boundary: [],
    heatPoints: [],
    showHeat: false,
  });
  expect(html).not.toContain('</script><script>alert(1)');
  expect(zoomForDelta(0.025)).toBe(14);
  expect(zoomForDelta(10)).toBe(10);
});
