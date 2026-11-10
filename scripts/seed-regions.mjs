/**
 * Seeds the Firestore data behind the region pages:
 *
 *   regions/{slug}                          page content (one per RA)
 *   regions/{slug}/heatmap_layers/{layer}   heatmap points per period (5 layers per RA)
 *
 * Every entry of src/domains/region/constants/regions.json gets a document. Content comes from
 * scripts/region-data/<slug>.json when that file exists and from labelled sample data
 * (scripts/region-data/sample.mjs) otherwise. All of it is meant to be edited afterwards in the
 * Firebase console, so by default the script only creates documents that do not exist yet;
 * pass --overwrite to replace everything with the generated version.
 *
 * Usage (Bun):
 *   bun scripts/seed-regions.mjs --dry-run                      # print the documents
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 bun scripts/seed-regions.mjs --project demo-x
 *   ACCESS_TOKEN=<oauth token> bun scripts/seed-regions.mjs --project app-dev-class-c3f1e
 *
 * Production needs an OAuth access token with Firestore access, e.g.
 * `gcloud auth print-access-token`. Security rules block client writes, so the script talks
 * to the Firestore REST API directly. A full seed is about 220 document writes, well inside
 * the Spark plan's free daily quota.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import regionList from '../src/domains/region/constants/regions.json';
import { sampleHeatmapLayers, sampleIncomeRanking, sampleRegionContent } from './region-data/sample.mjs';

const DATA_DIR = join(import.meta.dir, 'region-data');
/** Zoom span used for RAs without a hand-drawn outline (about 2.5 km). */
const DEFAULT_DELTA = 0.025;
/** Writes per commit request; keeps each request far below Firestore's size limit. */
const COMMIT_SIZE = 40;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dryRun = process.argv.includes('--dry-run');
const overwrite = process.argv.includes('--overwrite');
const projectId = argument('--project') ?? process.env.FIREBASE_PROJECT_ID;
const databaseId = argument('--database') ?? process.env.FIRESTORE_DB_NAME ?? 'app-db';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

function readDetails(slug) {
  const path = join(DATA_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  const { slug: fileSlug, ...details } = JSON.parse(readFileSync(path, 'utf8'));
  if (fileSlug !== slug) throw new Error(`${path}: slug "${fileSlug}" != "${slug}"`);
  return details;
}

/** Firestore data for every RA (a `RegionDetails` without its slug), keyed by slug. */
export function buildRegionDocuments() {
  const details = new Map(regionList.map(({ slug }) => [slug, readDetails(slug)]));
  const knownIncome = [...details.values()].flatMap((entry) => entry?.income?.ranking ?? []);
  const ranking = sampleIncomeRanking(regionList, knownIncome);
  const documents = {};

  for (const region of regionList) {
    const { slug, name, forumCity, center } = region;
    documents[slug] = {
      name,
      forumCity,
      ...sampleRegionContent(region, ranking),
      location: { ...center, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA, boundary: [] },
      // Detail files win over the samples; they are still examples unless they say otherwise.
      ...details.get(slug),
    };
    documents[slug].isSample = details.get(slug)?.isSample ?? true;
  }

  return documents;
}

/** Heatmap layer documents keyed by "slug/layerId". */
export function buildHeatmapDocuments() {
  const documents = {};
  for (const { slug, center } of regionList) {
    for (const [layerId, layer] of Object.entries(sampleHeatmapLayers(slug, center))) {
      documents[`${slug}/${layerId}`] = layer;
    }
  }
  return documents;
}

/** Plain JSON → Firestore REST `Value`. */
function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toValue(item)])),
      },
    };
  }
  throw new Error(`Unsupported value: ${String(value)}`);
}

async function main() {
  const regions = buildRegionDocuments();
  const layers = buildHeatmapDocuments();

  if (dryRun) {
    console.log(JSON.stringify({ regions, heatmapLayers: layers }, null, 2));
    console.error(
      `${Object.keys(regions).length} regions, ${Object.keys(layers).length} heatmap layers ` +
        '(dry run, nothing written).'
    );
    return;
  }

  if (!projectId) throw new Error('Pass --project <id> or set FIREBASE_PROJECT_ID.');
  const token = emulatorHost ? 'owner' : process.env.ACCESS_TOKEN;
  if (!token) throw new Error('Set ACCESS_TOKEN (or FIRESTORE_EMULATOR_HOST for the emulator).');

  const baseUrl = emulatorHost ? `http://${emulatorHost}/v1` : 'https://firestore.googleapis.com/v1';
  const database = `projects/${projectId}/databases/${databaseId}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const all = [
    ...Object.entries(regions).map(([slug, data]) => [`regions/${slug}`, data]),
    ...Object.entries(layers).map(([key, data]) => {
      const [slug, layerId] = key.split('/');
      return [`regions/${slug}/heatmap_layers/${layerId}`, data];
    }),
  ].map(([path, data]) => ({ name: `${database}/documents/${path}`, data }));

  // Without --overwrite, skip documents that already exist so console edits survive.
  let pending = all;
  if (!overwrite) {
    const existing = new Set();
    for (let i = 0; i < all.length; i += 100) {
      const response = await fetch(`${baseUrl}/${database}/documents:batchGet`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          documents: all.slice(i, i + 100).map((doc) => doc.name),
          mask: { fieldPaths: ['__name__'] },
        }),
      });
      if (!response.ok) throw new Error(`batchGet failed: ${response.status} ${await response.text()}`);
      for (const result of await response.json()) if (result.found) existing.add(result.found.name);
    }
    pending = all.filter((doc) => !existing.has(doc.name));
    if (existing.size) {
      console.log(`Skipping ${existing.size} existing documents (use --overwrite to replace them).`);
    }
  }

  for (let i = 0; i < pending.length; i += COMMIT_SIZE) {
    const response = await fetch(`${baseUrl}/${database}/documents:commit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        writes: pending.slice(i, i + COMMIT_SIZE).map((doc) => ({
          update: { name: doc.name, fields: toValue(doc.data).mapValue.fields },
        })),
      }),
    });
    if (!response.ok) throw new Error(`Firestore commit failed: ${response.status} ${await response.text()}`);
  }

  console.log(
    `Wrote ${pending.length} documents to ${database}` + (emulatorHost ? ` (emulator ${emulatorHost})` : '')
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
