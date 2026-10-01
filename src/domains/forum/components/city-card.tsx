import { Pressable, StyleSheet } from 'react-native';

import { CardFeed } from '@/components/card-feed';

import type { CityOverview } from '../hooks/use-city-overview';
import { formatRelativeTime, isRecentlyActive } from '../utils/format';

export function CityCard({ overview, onPress }: { overview: CityOverview; onPress: () => void }) {
  const { city, topicsCount, repliesCount, likesCount, latestTopic, lastActivityAt } = overview;

  return (
    <Pressable
      accessibilityHint="Abre o fórum desta RA"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
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
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
});
