/**
 * Placeholder content for region pages and heatmaps until official data arrives. Everything
 * here is deterministic (seeded by the region slug), so re-running the seed gives the same
 * documents, and everything is flagged `isSample: true` so the app labels it.
 */

export const SAMPLE_SOURCE = 'Dados de exemplo';

/** Small seeded PRNG (mulberry32) keyed by a string. */
export function randomFor(key) {
  let seed = 2166136261;
  for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, digits) => Number(value.toFixed(digits));
const pick = (random, items, count) =>
  [...items].sort(() => random() - 0.5).slice(0, count);

const PERIODS = ['madrugada', 'manha', 'tarde', 'noite'];

/** RAs served by the metro line (used only to make the sample mobility card plausible). */
const METRO_RAS = new Set([
  'asa-sul', 'plano-piloto', 'guara', 'aguas-claras', 'arniqueira', 'taguatinga',
  'ceilandia', 'samambaia', 'park-way', 'sia', 'sudoeste-octogonal',
]);

const TAGS = [
  'Bem-localizado', 'Custo-benefício', 'Tranquilo', 'Comércio forte', 'Arborizado',
  'Vida noturna', 'Familiar', 'Em crescimento', 'Bom transporte',
];
const SURROUNDINGS = [
  'Rua asfaltada', 'Rua iluminada', 'Rua com calçada', 'Ruas arborizadas',
  'Drenagem de chuva', 'Coleta de lixo',
];
const LEISURE = [
  'Ponto de ônibus', 'Ruas arborizadas', 'Quadras esportivas', 'Praça', 'Academia/PEC',
  'Travessia sinalizada', 'Jardins/Parques', 'Ciclovia/Ciclofaixa', 'Espaço cultural',
];
const CRIMES = [
  'Homicídio', 'Roubo de veículo', 'Furto de veículo', 'Roubo em coletivo',
  'Roubo em comércio', 'Roubo a pedestre', 'Furto a pedestre',
];
const MOBILITY_SUMMARIES = [
  'Várias linhas de ônibus ligam a região ao Plano Piloto.',
  'Boa oferta de ônibus nos horários de pico; à noite a frequência cai.',
  'Vias principais duplicadas e ciclovias em expansão.',
];

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Sample income of every RA; values from `known` (e.g. a detail file) are kept. */
export function sampleIncomeRanking(regions, known = []) {
  const values = new Map(known.map((entry) => [entry.region, entry.value]));
  return regions.map(({ name, slug }) => ({
    region: name,
    value: values.get(name) ?? round(2500 + randomFor(`income:${slug}`)() * 9500, 1),
  }));
}

/** A complete region document (minus location) filled with labelled placeholder values. */
export function sampleRegionContent({ slug, name }, incomeRanking) {
  const random = randomFor(`region:${slug}`);
  const income = incomeRanking.find((entry) => entry.region === name)?.value ?? 0;

  return {
    photos: [],
    tags: pick(random, TAGS, 2 + Math.floor(random() * 2)),
    description:
      `${name} é uma das regiões administrativas do Distrito Federal. Este texto é um exemplo ` +
      'e será substituído por uma descrição com dados oficiais sobre moradia, serviços e ' +
      'qualidade de vida na região.',
    mobility: {
      title: 'Mobilidade',
      summary: MOBILITY_SUMMARIES[Math.floor(random() * MOBILITY_SUMMARIES.length)],
      modes: [
        { mode: 'metro', label: 'Metrô', available: METRO_RAS.has(slug) },
        { mode: 'bus', label: 'Ônibus', available: true },
        { mode: 'bike', label: 'Ciclovia', available: random() > 0.35 },
      ],
      source: SAMPLE_SOURCE,
    },
    surroundings: {
      title: 'Moradores afirmaram ter na rua ou nas proximidades',
      items: SURROUNDINGS.filter(() => random() > 0.25),
      source: SAMPLE_SOURCE,
    },
    leisure: {
      title: 'Lazer',
      items: LEISURE.map((label) => ({ label, percentage: round(50 + random() * 49, 1) })).sort(
        (a, b) => b.percentage - a.percentage
      ),
      source: SAMPLE_SOURCE,
    },
    income: {
      title: 'Rendimento domiciliar',
      description:
        `Valor de exemplo: a renda domiciliar média mensal de ${name} aparece como ` +
        `${currency.format(income)}. O gráfico compara todas as RAs do DF.`,
      ranking: incomeRanking,
      source: SAMPLE_SOURCE,
    },
    safety: {
      title: 'Segurança',
      axisTicks: [0, 10, 25, 50, 100, 150],
      occurrences: CRIMES.map((label) => ({
        label,
        count: Math.round(label === 'Homicídio' ? random() * 12 : 2 + random() * 180),
      })),
      summary: 'Ocorrências de exemplo por tipo de crime no último ano.',
      source: SAMPLE_SOURCE,
    },
    isSample: true,
  };
}

/**
 * Heatmap layers, in chip order. `activity` scales each period (0 to 1); hotspot `kind` picks
 * where the points cluster: the commercial core, the main avenue, transit stops or parks.
 */
const LAYERS = [
  {
    id: 'popularidade',
    label: 'Popularidade',
    icon: 'flame-outline',
    description: 'Onde as pessoas se concentram em cada horário.',
    colors: ['#F7C6D6', '#E96E97', '#B83A6B', '#832D51'],
    activity: { madrugada: 0.25, manha: 0.55, tarde: 0.75, noite: 1 },
    hotspots: [['core', 1], ['avenue', 0.7], ['hub', 0.6]],
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    icon: 'shield-outline',
    description: 'Locais com mais ocorrências registradas.',
    colors: ['#FFE08A', '#FDAE61', '#F46D43', '#B2182B'],
    activity: { madrugada: 0.9, manha: 0.35, tarde: 0.5, noite: 1 },
    hotspots: [['core', 0.9], ['stops', 0.8], ['edge', 0.6]],
  },
  {
    id: 'transporte',
    label: 'Transporte',
    icon: 'bus-outline',
    description: 'Paradas e vias com mais movimento de ônibus, metrô e bicicletas.',
    colors: ['#C6DBEF', '#6BAED6', '#2171B5', '#08306B'],
    activity: { madrugada: 0.1, manha: 1, tarde: 0.6, noite: 0.85 },
    hotspots: [['avenue', 1], ['stops', 0.9], ['hub', 0.8]],
  },
  {
    id: 'lazer',
    label: 'Lazer',
    icon: 'leaf-outline',
    description: 'Parques, praças e espaços culturais mais frequentados.',
    colors: ['#C7E9C0', '#74C476', '#31A354', '#006D2C'],
    activity: { madrugada: 0.05, manha: 0.6, tarde: 1, noite: 0.7 },
    hotspots: [['parks', 1], ['core', 0.5]],
  },
  {
    id: 'mercado',
    label: 'Mercado',
    icon: 'cart-outline',
    description: 'Comércio e serviços com mais procura.',
    colors: ['#FDD0A2', '#FD8D3C', '#D94801', '#7F2704'],
    activity: { madrugada: 0.05, manha: 0.8, tarde: 1, noite: 0.6 },
    hotspots: [['core', 1], ['avenue', 0.6], ['hub', 0.7]],
  },
];

export const SAMPLE_LAYER_IDS = LAYERS.map((layer) => layer.id);

/** Fixed places of an RA shared by every layer, so layers overlap where they should. */
function regionPlaces(slug, { latitude, longitude }) {
  const random = randomFor(`places:${slug}`);
  const offset = (spread) => (random() - 0.5) * spread;
  const angle = random() * Math.PI;
  const at = (dLat, dLng) => ({ latitude: latitude + dLat, longitude: longitude + dLng });
  const avenueLength = 0.006 + random() * 0.003;

  return {
    core: [at(offset(0.003), offset(0.003))],
    avenue: [
      at(-Math.sin(angle) * avenueLength, -Math.cos(angle) * avenueLength),
      at(Math.sin(angle) * avenueLength, Math.cos(angle) * avenueLength),
    ],
    hub: [at(offset(0.012), offset(0.012))],
    stops: Array.from({ length: 4 }, () => at(offset(0.014), offset(0.014))),
    parks: Array.from({ length: 3 }, () => at(offset(0.016), offset(0.016))),
    edge: Array.from({ length: 2 }, () => at(offset(0.02), offset(0.02))),
  };
}

/** Weighted points for one layer and period. */
function layerPoints(layer, places, period, random) {
  const activity = layer.activity[period];
  // Quiet periods keep a faint trace instead of an empty map.
  const intensity = 0.15 + 0.85 * activity;
  const points = [];
  const push = (latitude, longitude, weight) => {
    if (weight >= 0.05) {
      points.push({ latitude: round(latitude, 5), longitude: round(longitude, 5), weight: round(weight, 2) });
    }
  };

  for (const [kind, strength] of layer.hotspots) {
    const spots = places[kind];
    if (kind === 'avenue') {
      const [from, to] = spots;
      const count = Math.round(14 * activity) + 2;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        push(
          from.latitude + t * (to.latitude - from.latitude) + (random() - 0.5) * 0.0006,
          from.longitude + t * (to.longitude - from.longitude) + (random() - 0.5) * 0.0006,
          strength * intensity * (0.6 + random() * 0.4)
        );
      }
      continue;
    }
    for (const spot of spots) {
      const count = Math.round((kind === 'core' ? 22 : 9) * activity) + 2;
      const spread = kind === 'core' ? 0.0035 : 0.002;
      for (let i = 0; i < count; i++) {
        const distance = Math.pow(random(), 1.4);
        const angle = random() * Math.PI * 2;
        push(
          spot.latitude + Math.sin(angle) * distance * spread,
          spot.longitude + Math.cos(angle) * distance * spread * 1.2,
          strength * intensity * (1 - distance * 0.6)
        );
      }
    }
  }
  return points;
}

/** Every heatmap layer document of an RA, keyed by layer id. */
export function sampleHeatmapLayers(slug, center) {
  const places = regionPlaces(slug, center);
  return Object.fromEntries(
    LAYERS.map((layer, order) => {
      const random = randomFor(`heat:${slug}:${layer.id}`);
      return [
        layer.id,
        {
          label: layer.label,
          description: layer.description,
          icon: layer.icon,
          order,
          colors: layer.colors,
          source: SAMPLE_SOURCE,
          isSample: true,
          periods: Object.fromEntries(
            PERIODS.map((period) => [period, layerPoints(layer, places, period, random)])
          ),
        },
      ];
    })
  );
}
