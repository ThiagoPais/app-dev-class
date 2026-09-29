import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import type { VoteType } from '../models/forumTypes';

interface VoteControlProps {
  netVotes: number;
  vote: VoteType | null;
  onVote: (voteType: VoteType) => void;
  size?: 'small' | 'regular';
}

export function VoteControl({ netVotes, vote, onVote, size = 'regular' }: VoteControlProps) {
  const iconSize = size === 'small' ? 16 : 20;

  return (
    <View style={[styles.container, size === 'small' && styles.containerSmall]}>
      <Pressable
        accessibilityLabel={vote === 'up' ? 'Remover voto positivo' : 'Votar a favor'}
        accessibilityRole="button"
        accessibilityState={{ selected: vote === 'up' }}
        hitSlop={8}
        onPress={() => onVote('up')}
        style={({ pressed }) => pressed && styles.pressed}>
        <Ionicons
          color={vote === 'up' ? BrandColors.primary : BrandColors.textSecondary}
          name={vote === 'up' ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
          size={iconSize}
        />
      </Pressable>
      <Text
        style={[
          styles.count,
          size === 'small' && styles.countSmall,
          vote === 'up' && styles.countUp,
          vote === 'down' && styles.countDown,
        ]}>
        {netVotes}
      </Text>
      <Pressable
        accessibilityLabel={vote === 'down' ? 'Remover voto negativo' : 'Votar contra'}
        accessibilityRole="button"
        accessibilityState={{ selected: vote === 'down' }}
        hitSlop={8}
        onPress={() => onVote('down')}
        style={({ pressed }) => pressed && styles.pressed}>
        <Ionicons
          color={vote === 'down' ? BrandColors.textPrimary : BrandColors.textSecondary}
          name={vote === 'down' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
          size={iconSize}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#F5F0F2',
  },
  containerSmall: {
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  count: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: BrandColors.textSecondary,
  },
  countSmall: {
    fontSize: 12,
  },
  countUp: {
    color: BrandColors.primary,
  },
  countDown: {
    color: BrandColors.textPrimary,
  },
  pressed: {
    opacity: 0.6,
  },
});
