/**
 * Writes one Firestore document per RA to the `regions` collection.
 *
 * Every entry of src/domains/region/constants/regions.json gets a document with its location
 * and heatmap inputs. RAs with a file in scripts/region-data/<slug>.json also get photos, tags,
 * and the indicator cards. Documents are replaced as a whole, so the JSON is the source of truth.
 *
 * Usage (Bun):
 *   bun scripts/seed-regions.mjs --dry-run                      # print the documents
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 bun scripts/seed-regions.mjs --project demo-x
 *   ACCESS_TOKEN=<oauth token> bun scripts/seed-regions.mjs --project app-dev-class-c3f1e
 *
 * Production needs an OAuth access token with Datastore/Firestore access, e.g.
 * `gcloud auth print-access-token`. Security rules block client writes to `regions`, so the
 * script talks to the Firestore REST API directly. Writes cost one document write per RA,
 * well inside the Spark plan's free quota.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import regionList from '../src/domains/region/constants/regions.json';
import { defaultPopularity } from '../src/domains/region/utils/heat-points';

const DATA_DIR = join(import.meta.dir, 'region-data');
/** Zoom span used for RAs without a hand-drawn outline (about 2.5 km). */
const DEFAULT_DELTA = 0.025;
const POPULARITY_SOURCE = 'Estimativa Mapeei (ilustrativa, sem medição por horário)';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dryRun = process.argv.includes('--dry-run');
const projectId = argument('--project') ?? process.env.FIREBASE_PROJECT_ID;
const databaseId = argument('--database') ?? process.env.FIRESTORE_DB_NAME ?? 'app-db';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

/** Firestore data for every RA (a `RegionDetails` without its slug), keyed by slug. */
export function buildRegionDocuments() {
  const documents = {};

  for (const { slug, name, forumCity, center } of regionList) {
    const base = {
      name,
      forumCity,
      photos: [],
      tags: [],
      description: null,
      mobility: null,
      surroundings: null,
      leisure: null,
      income: null,
      safety: null,
      location: {
        ...center,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
        boundary: [],
      },
      popularity: defaultPopularity(center, POPULARITY_SOURCE),
    };

    const detailsPath = join(DATA_DIR, `${slug}.json`);
    if (existsSync(detailsPath)) {
      const { slug: detailsSlug, ...details } = JSON.parse(readFileSync(detailsPath, 'utf8'));
      if (detailsSlug !== slug) throw new Error(`${detailsPath}: slug "${detailsSlug}" != "${slug}"`);
      Object.assign(base, details);
    }

    documents[slug] = base;
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
  const documents = buildRegionDocuments();

  if (dryRun) {
    console.log(JSON.stringify(documents, null, 2));
    console.error(`${Object.keys(documents).length} documents (dry run, nothing written).`);
    return;
  }

  if (!projectId) throw new Error('Pass --project <id> or set FIREBASE_PROJECT_ID.');
  const token = emulatorHost ? 'owner' : process.env.ACCESS_TOKEN;
  if (!token) throw new Error('Set ACCESS_TOKEN (or FIRESTORE_EMULATOR_HOST for the emulator).');

  const baseUrl = emulatorHost
    ? `http://${emulatorHost}/v1`
    : 'https://firestore.googleapis.com/v1';
  const database = `projects/${projectId}/databases/${databaseId}`;

  // One commit replaces every document atomically (max 500 writes; there are under 40 RAs).
  const response = await fetch(`${baseUrl}/${database}/documents:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: Object.entries(documents).map(([slug, data]) => ({
        update: {
          name: `${database}/documents/regions/${slug}`,
          fields: toValue(data).mapValue.fields,
        },
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Firestore commit failed: ${response.status} ${await response.text()}`);
  }
  console.log(
    `Wrote ${Object.keys(documents).length} region documents to ${database}` +
      (emulatorHost ? ` (emulator ${emulatorHost})` : '')
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
