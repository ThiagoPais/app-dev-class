import { useLocalSearchParams } from 'expo-router';

import { RegionDetailScreen } from '@/domains/region';

export default function RegionDetailRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <RegionDetailScreen key={slug} slug={slug} />;
}
