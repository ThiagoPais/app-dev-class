import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';

import { db } from '@/services/firebase';

import { REGIONS } from '../constants/regions';
import type { HeatmapLayer, RegionDetails, RegionSummary } from '../models/region.types';
import { parseHeatmapLayer, parseRegionDocument } from '../utils/parse-region';

/** Firestore collection with one document per RA, keyed by slug. Written only by the seed script. */
export const REGIONS_COLLECTION = 'regions';
/** Subcollection of each region with one document per heatmap layer. */
export const HEATMAP_LAYERS_COLLECTION = 'heatmap_layers';

/** The search list ships with the app, so browsing RAs costs no Firestore reads. */
export function listRegions(): RegionSummary[] {
  return REGIONS;
}

/** One document read per page view. Resolves null when the RA has no (valid) document yet. */
export async function getRegionDetails(slug: string): Promise<RegionDetails | null> {
  const snapshot = await getDoc(doc(db, REGIONS_COLLECTION, slug));
  return snapshot.exists() ? parseRegionDocument(slug, snapshot.data()) : null;
}

/** Every heatmap layer of an RA in chip order: one read per layer, only when the map is opened. */
export async function getHeatmapLayers(slug: string): Promise<HeatmapLayer[]> {
  const snapshot = await getDocs(
    query(collection(db, REGIONS_COLLECTION, slug, HEATMAP_LAYERS_COLLECTION), orderBy('order'))
  );
  return snapshot.docs
    .map((layer) => parseHeatmapLayer(layer.id, layer.data()))
    .filter((layer): layer is HeatmapLayer => layer !== null);
}
