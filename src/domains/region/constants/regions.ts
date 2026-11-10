import type { RegionSummary } from '../models/region.types';
import regionList from './regions.json';

/**
 * Every RA that has a page, in alphabetical order. Plano Piloto also appears as its two wings
 * because people search for the neighborhood they would live in. `regions.json` is shared with
 * `scripts/seed-regions.mjs`, which creates one Firestore document per entry.
 */
export const REGIONS: RegionSummary[] = regionList
  .map(({ slug, name, forumCity }) => ({ slug, name, forumCity }))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

/** Slug of the region page for a forum RA name, e.g. "São Sebastião" → "sao-sebastiao". */
export function regionSlugForForumCity(city: string): string | null {
  return REGIONS.find((region) => region.name === city)?.slug ?? null;
}
