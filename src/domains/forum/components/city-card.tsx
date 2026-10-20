import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { CardFeed } from '@/components/card-feed';
import { BrandColors } from '@/shared/constants/colors';

import type { CityOverview } from '../hooks/use-city-overview';
import { formatRelativeTime, isRecentlyActive } from '../utils/format';

export function CityCard({ overview, onPress }: { overview: CityOverview; onPress: () => void }) {
  const { city, topicsCount, repliesCount, likesCount, latestTopic, lastActivityAt } = overview;

  return (
    <Pressable
      accessibilityHint="Abre o fórum desta RA"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <CardFeed
        active={lastActivityAt ? isRecentlyActive(lastActivityAt) : false}
        conversations={topicsCount}
        description={
          latestTopic
            ? `${latestTopic.title}: ${latestTopic.content}`
            : 'Nenhuma conversa ainda. Seja o primeiro a puxar assunto!'
        }
        descriptionLines={2}
        inactiveLabel={lastActivityAt ? 'Última atividade' : 'Sem conversas'}
        lastActivity={lastActivityAt ? formatRelativeTime(lastActivityAt) : undefined}
        likes={likesCount}
        messages={repliesCount}
        title={city}
        action={
          <Pressable
            accessibilityLabel={`Ver detalhes de ${city}`}
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => router.push({ pathname: '/region/[city]', params: { city } })}
            style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
          >
            <Ionicons color={BrandColors.primary} name="information-circle-outline" size={14} />
            <Text style={styles.detailsText}>Sobre a região</Text>
          </Pressable>
        }
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#FCE4EF',
  },
  detailsText: {
    color: BrandColors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
