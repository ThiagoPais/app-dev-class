import { expect, test } from 'bun:test';

import { SAMPLE_LAYER_IDS } from '../scripts/region-data/sample.mjs';
import { buildHeatmapDocuments, buildRegionDocuments } from '../scripts/seed-regions.mjs';
import { FORUM_CITIES } from '../src/domains/forum/constants/regions.ts';
import regionList from '../src/domains/region/constants/regions.json';
import { HEAT_PERIODS, periodForHour } from '../src/domains/region/utils/heatmap.ts';
import { buildMapHtml, heatMessage, zoomForDelta } from '../src/domains/region/utils/map-html.ts';
import { parseHeatmapLayer, parseRegionDocument } from '../src/domains/region/utils/parse-region.ts';
import { slugify } from '../src/shared/utils/slugify.ts';

const regions = buildRegionDocuments();
const layers = buildHeatmapDocuments();

test('every forum RA has a region page reachable by slug', () => {
  const slugs = new Set(regionList.map((region) => region.slug));
  for (const city of FORUM_CITIES) expect(slugs.has(slugify(city))).toBe(true);
});

test('region slugs match their names and are unique', () => {
  const slugs = regionList.map((region) => region.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const region of regionList) expect(region.slug).toBe(slugify(region.name));
});

test('every seeded region has every card, flagged as sample data', () => {
  expect(Object.keys(regions)).toHaveLength(regionList.length);
  for (const [slug, data] of Object.entries(regions)) {
    const region = parseRegionDocument(slug, data);
    expect(region).not.toBeNull();
    expect(region.isSample).toBe(true);
    expect(region.description).toBeTruthy();
    for (const card of ['mobility', 'surroundings', 'leisure', 'income', 'safety']) {
      expect(region[card]).not.toBeNull();
    }
    expect(region.income.ranking.some((entry) => entry.region === region.name)).toBe(true);
    expect(region.location.latitude).toBeLessThan(-15);
    expect(FORUM_CITIES).toContain(region.forumCity);
  }
});

test('detail files override the samples', () => {
  const asaNorte = parseRegionDocument('asa-norte', regions['asa-norte']);
  expect(asaNorte.photos.length).toBeGreaterThan(0);
  expect(asaNorte.location.boundary.length).toBeGreaterThan(2);
  expect(asaNorte.mobility.summary).toBe('Muitas linhas de ônibus, mas carece de metrô.');
});

test('every region gets every heatmap layer with points for every period', () => {
  expect(Object.keys(layers)).toHaveLength(regionList.length * SAMPLE_LAYER_IDS.length);
  for (const [key, data] of Object.entries(layers)) {
    const layer = parseHeatmapLayer(key.split('/')[1], data);
    expect(layer.isSample).toBe(true);
    expect(layer.colors.length).toBeGreaterThanOrEqual(2);
    for (const { id } of HEAT_PERIODS) {
      expect(layer.periods[id].length).toBeGreaterThan(0);
      for (const point of layer.periods[id]) {
        expect(point.weight).toBeGreaterThan(0);
        expect(point.weight).toBeLessThanOrEqual(1);
      }
    }
  }
});

test('busy periods have more heat than quiet ones', () => {
  const weight = (layer, period) =>
    layer.periods[period].reduce((sum, point) => sum + point.weight, 0);
  const transport = layers['gama/transporte'];
  expect(weight(transport, 'manha')).toBeGreaterThan(weight(transport, 'madrugada'));
  const leisure = layers['gama/lazer'];
  expect(weight(leisure, 'tarde')).toBeGreaterThan(weight(leisure, 'madrugada'));
});

test('seeding is deterministic', () => {
  expect(buildHeatmapDocuments()['asa-sul/popularidade']).toEqual(layers['asa-sul/popularidade']);
});

test('parsers tolerate hand-edited documents', () => {
  expect(parseRegionDocument('x', undefined)).toBeNull();
  expect(parseRegionDocument('x', { name: 'X' })).toBeNull();
  const minimal = parseRegionDocument('x', { name: 'X', location: { latitude: 1, longitude: 2 } });
  expect(minimal.forumCity).toBe('X');
  expect(minimal.isSample).toBe(false);

  expect(parseHeatmapLayer('x', { description: 'sem rótulo' })).toBeNull();
  const edited = parseHeatmapLayer('x', {
    label: 'Teste',
    colors: ['vermelho'],
    periods: {
      noite: [{ latitude: 1, longitude: 2, weight: 3 }, { latitude: 'a' }, { latitude: 1, longitude: 2 }],
    },
  });
  expect(edited.colors.length).toBe(4);
  expect(edited.periods.manha).toEqual([]);
  expect(edited.periods.noite).toEqual([
    { latitude: 1, longitude: 2, weight: 1 },
    { latitude: 1, longitude: 2, weight: 1 },
  ]);
});

test('periodForHour follows the clock', () => {
  expect(periodForHour(3)).toBe('madrugada');
  expect(periodForHour(9)).toBe('manha');
  expect(periodForHour(15)).toBe('tarde');
  expect(periodForHour(22)).toBe('noite');
});

test('map HTML escapes names and heat messages carry weights', () => {
  const html = buildMapHtml({
    name: '</script><script>alert(1)</script>',
    center: { latitude: -15.8, longitude: -47.9 },
    zoom: 14,
    boundary: [],
  });
  expect(html).not.toContain('</script><script>alert(1)');
  expect(html).toContain('leaflet-heat.js');
  expect(heatMessage([{ latitude: 1, longitude: 2, weight: 0.5 }], ['#000000']).points).toEqual([
    [1, 2, 0.5],
  ]);
  expect(zoomForDelta(0.025)).toBe(14);
});
