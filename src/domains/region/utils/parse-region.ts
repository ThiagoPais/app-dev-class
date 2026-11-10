import type {
  Coordinate,
  PopularityInfo,
  RegionDetails,
  RegionLocation,
} from '../models/region.types';

type Data = Record<string, unknown>;

const HEAT_PERIODS = ['madrugada', 'manha', 'tarde', 'noite'] as const;

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
    latitudeDelta: typeof data.latitudeDelta === 'number' ? data.latitudeDelta : 0.04,
    longitudeDelta: typeof data.longitudeDelta === 'number' ? data.longitudeDelta : 0.04,
    boundary: Array.isArray(data.boundary) ? data.boundary.filter(isCoordinate) : [],
  };
}

function parsePopularity(value: unknown): PopularityInfo | null {
  if (!isObject(value) || !isCoordinate(value.core) || !isObject(value.strip)) return null;
  const { from, to } = value.strip;
  const periods = value.periods;
  if (!isCoordinate(from) || !isCoordinate(to) || !isObject(periods)) return null;

  const parsed = {} as PopularityInfo['periods'];
  for (const period of HEAT_PERIODS) {
    const levels = periods[period];
    if (!isObject(levels) || typeof levels.core !== 'number' || typeof levels.strip !== 'number') {
      return null;
    }
    parsed[period] = { core: levels.core, strip: levels.strip };
  }

  return {
    core: value.core,
    strip: { from, to },
    periods: parsed,
    source: typeof value.source === 'string' ? value.source : '',
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
    popularity: parsePopularity(data.popularity),
  };
}
