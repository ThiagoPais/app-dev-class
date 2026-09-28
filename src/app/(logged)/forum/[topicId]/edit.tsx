import { useLocalSearchParams } from 'expo-router';

import { TopicFormScreen } from '@/domains/forum';

export default function EditTopicRoute() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  return <TopicFormScreen key={topicId} topicId={topicId} />;
}
