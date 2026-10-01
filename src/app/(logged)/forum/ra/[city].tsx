import { useLocalSearchParams } from 'expo-router';

import { CityForumScreen } from '@/domains/forum';

export default function CityForumRoute() {
  const { city } = useLocalSearchParams<{ city: string }>();
  return <CityForumScreen city={city} key={city} />;
}
