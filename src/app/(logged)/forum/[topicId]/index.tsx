import { useLocalSearchParams } from 'expo-router';

import { TopicDetailScreen } from '@/domains/forum';

export default function TopicDetailRoute() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  return <TopicDetailScreen key={topicId} topicId={topicId} />;
}
