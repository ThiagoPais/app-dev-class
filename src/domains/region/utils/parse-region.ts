import type {
  Coordinate,
  HeatmapLayer,
  HeatPoint,
  RegionDetails,
  RegionLocation,
} from '../models/region.types';
import { DEFAULT_HEAT_COLORS, HEAT_PERIODS } from './heatmap';

type Data = Record<string, unknown>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isObject(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is Coordinate {
  return (
    isObject(value) &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number'
  );
}

function parseLocation(value: unknown): RegionLocation | null {
  if (!isCoordinate(value)) return null;
  const data = value as unknown as Data;
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    latitudeDelta: typeof data.latitudeDelta === 'number' ? data.latitudeDelta : 0.025,
    longitudeDelta: typeof data.longitudeDelta === 'number' ? data.longitudeDelta : 0.025,
    boundary: Array.isArray(data.boundary) ? data.boundary.filter(isCoordinate) : [],
  };
}

/** Section objects are trusted once present; the seed script writes them from typed JSON. */
function section<T>(value: unknown): T | null {
  return isObject(value) ? (value as T) : null;
}

/**
 * Turns a `regions/{slug}` document into the page model. Returns null when the document is
 * missing the fields every page needs (name and location), so the screen shows its empty state
 * instead of crashing on a half-written document.
 */
export function parseRegionDocument(slug: string, data: Data | undefined): RegionDetails | null {
  if (!data || typeof data.name !== 'string') return null;
  const location = parseLocation(data.location);
  if (!location) return null;

  return {
    slug,
    name: data.name,
    forumCity: typeof data.forumCity === 'string' ? data.forumCity : data.name,
    photos: Array.isArray(data.photos)
      ? data.photos.filter((photo) => isObject(photo) && typeof photo.uri === 'string')
      : [],
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    description: typeof data.description === 'string' ? data.description : null,
    mobility: section(data.mobility),
    surroundings: section(data.surroundings),
    leisure: section(data.leisure),
    income: section(data.income),
    safety: section(data.safety),
    location,
    isSample: data.isSample === true,
  };
}

/** Keeps points with valid coordinates and clamps their weight to [0, 1]. */
function parsePoints(value: unknown): HeatPoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCoordinate).map((point) => {
    const weight = (point as unknown as Data).weight;
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      weight: typeof weight === 'number' ? Math.min(1, Math.max(0, weight)) : 1,
    };
  });
}

/**
 * Turns a `regions/{slug}/heatmap_layers/{id}` document into a layer. Hand edits in the console
 * are expected, so missing fields get defaults instead of dropping the layer; a layer without a
 * label is skipped.
 */
export function parseHeatmapLayer(id: string, data: Data | undefined): HeatmapLayer | null {
  if (!data || typeof data.label !== 'string') return null;
  const periods = isObject(data.periods) ? data.periods : {};
  const colors = Array.isArray(data.colors)
    ? data.colors.filter((color): color is string => typeof color === 'string' && HEX_COLOR.test(color))
    : [];

  return {
    id,
    label: data.label,
    description: typeof data.description === 'string' ? data.description : '',
    icon: typeof data.icon === 'string' ? data.icon : 'layers-outline',
    order: typeof data.order === 'number' ? data.order : 0,
    colors: colors.length >= 2 ? colors : DEFAULT_HEAT_COLORS,
    source: typeof data.source === 'string' ? data.source : '',
    isSample: data.isSample === true,
    periods: Object.fromEntries(
      HEAT_PERIODS.map(({ id: period }) => [period, parsePoints(periods[period])])
    ) as HeatmapLayer['periods'],
  };
}
