import { useLocalSearchParams } from 'expo-router';

import { isForumCategory, TopicFormScreen } from '@/domains/forum';

export default function NewTopicRoute() {
  const { city, category } = useLocalSearchParams<{ city?: string; category?: string }>();
  return (
    <TopicFormScreen
      initialCategory={isForumCategory(category) ? category : null}
      initialCity={city ?? null}
    />
  );
}
