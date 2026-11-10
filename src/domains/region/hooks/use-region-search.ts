import { useState } from 'react';

import { listRegions } from '../services/region.service';
import { matchesSearch } from '../utils/slugify';

export function useRegionSearch() {
  const [search, setSearch] = useState('');
  const regions = listRegions().filter((region) => matchesSearch(region.name, search));

  return { regions, search, setSearch };
}
