import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import { getCategoryLabel } from '../constants/categories';
import type { ForumTopic } from '../models/forumTypes';
import { formatRelativeTime } from '../utils/format';
import { AuthorAvatar } from './author-avatar';

interface TopicCardProps {
  topic: ForumTopic;
  onPress: () => void;
  /** Tapping the author opens their mini profile. */
  onAuthorPress?: () => void;
}

export function TopicCard({ topic, onPress, onAuthorPress }: TopicCardProps) {
  // The card is a plain View with sibling pressables: on web each Pressable is a
  // <button>, and the author button cannot be nested inside the card button.
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityHint="Abre o tópico e suas respostas"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.header}>
          <Text numberOfLines={2} style={styles.title}>
            {topic.isPinned ? `📌 ${topic.title}` : topic.title}
          </Text>
          <View style={styles.badge}>
            <Text numberOfLines={1} style={styles.badgeText}>
              {getCategoryLabel(topic.category).toUpperCase()}
            </Text>
          </View>
        </View>

        <Text numberOfLines={2} style={styles.content}>
          {topic.content}
        </Text>
      </Pressable>

      <View style={styles.footer}>
        <Pressable
          accessibilityHint="Abre o perfil de quem criou o tópico"
          accessibilityRole="button"
          disabled={!onAuthorPress}
          hitSlop={6}
          onPress={onAuthorPress}
          style={({ pressed }) => [styles.author, pressed && styles.pressed]}>
          <AuthorAvatar author={topic.authorSnapshot} size={22} />
          <Text numberOfLines={1} style={styles.meta}>
            {topic.authorSnapshot.fullName || 'Usuário'} • {formatRelativeTime(topic.lastReplyAt)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${topic.repliesCount} respostas e ${topic.upvotesCount} curtidas`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.metrics, pressed && styles.pressed]}>
          <View style={styles.metric}>
            <Ionicons color={BrandColors.textSecondary} name="chatbubbles-outline" size={15} />
            <Text style={styles.metricText}>{topic.repliesCount}</Text>
          </View>
          <View style={styles.metric}>
            <Ionicons
              color={topic.upvotesCount > 0 ? BrandColors.primary : BrandColors.textSecondary}
              name={topic.upvotesCount > 0 ? 'heart' : 'heart-outline'}
              size={15}
            />
            <Text style={styles.metricText}>{topic.upvotesCount}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: BrandColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  badge: {
    flexShrink: 0,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#EEF2DC',
  },
  badgeText: {
    color: '#5C6B1F',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  content: {
    marginTop: 6,
    color: '#3F3F46',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  author: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    flexShrink: 1,
    color: BrandColors.textSecondary,
    fontSize: 12,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    color: BrandColors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
});
