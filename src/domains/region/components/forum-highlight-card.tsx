import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

export interface ForumHighlight {
  id: string;
  authorName: string;
  avatarUrl: string | null;
  votes: number;
  title: string;
  content: string;
}

/** One of the RA's most voted forum topics; opens the topic. */
export function ForumHighlightCard({
  highlight,
  onPress,
}: {
  highlight: ForumHighlight;
  onPress: () => void;
}) {
  const { authorName, avatarUrl, votes, title, content } = highlight;

  return (
    <Pressable
      accessibilityHint="Abre o tópico no fórum"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <UserAvatar avatarUrl={avatarUrl} name={authorName} size={32} />
        <Text numberOfLines={1} style={styles.author}>
          {authorName}
        </Text>
        <View accessibilityLabel={`${votes} votos`} accessible style={styles.likes}>
          <Ionicons color={BrandColors.textSecondary} name="heart-outline" size={15} />
          <Text style={styles.likesText}>{votes}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <Text numberOfLines={3} style={styles.content}>
        {content}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: BrandColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  author: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 15,
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  likesText: {
    color: BrandColors.textSecondary,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  title: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    color: BrandColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});
