import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/services/firebase';

import { REGIONS } from '../constants/regions';
import type { RegionDetails, RegionSummary } from '../models/region.types';
import { parseRegionDocument } from '../utils/parse-region';

/** Firestore collection with one document per RA, keyed by slug. Written only by the seed script. */
export const REGIONS_COLLECTION = 'regions';

/** The search list ships with the app, so browsing RAs costs no Firestore reads. */
export function listRegions(): RegionSummary[] {
  return REGIONS;
}

/** One document read per page view. Resolves null when the RA has no (valid) document yet. */
export async function getRegionDetails(slug: string): Promise<RegionDetails | null> {
  const snapshot = await getDoc(doc(db, REGIONS_COLLECTION, slug));
  return snapshot.exists() ? parseRegionDocument(slug, snapshot.data()) : null;
}
