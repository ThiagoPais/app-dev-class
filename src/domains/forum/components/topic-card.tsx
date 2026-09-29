import { Pressable, StyleSheet } from 'react-native';

import { CardFeed } from '@/components/card-feed';

import type { ForumTopic } from '../models/forumTypes';
import { formatRelativeTime, isRecentlyActive } from '../utils/format';

export function TopicCard({ topic, onPress }: { topic: ForumTopic; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint="Abre o tópico e suas respostas"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <CardFeed
        active={isRecentlyActive(topic.lastReplyAt)}
        badgeLabel={topic.city}
        conversations={topic.repliesCount}
        description={topic.content}
        descriptionLines={3}
        lastActivity={formatRelativeTime(topic.lastReplyAt)}
        likes={topic.upvotesCount}
        messages={topic.repliesCount}
        title={topic.isPinned ? `📌 ${topic.title}` : topic.title}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
});
