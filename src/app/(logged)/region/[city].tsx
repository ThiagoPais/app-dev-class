import { useLocalSearchParams } from 'expo-router';

import { RegionDetailScreen } from '@/domains/region';

export default function RegionRoute() {
  const { city } = useLocalSearchParams<{ city: string }>();
  return <RegionDetailScreen city={city} key={city} />;
}
