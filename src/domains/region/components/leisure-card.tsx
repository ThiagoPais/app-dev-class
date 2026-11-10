import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import type { LeisureInfo } from '../models/region.types';
import { InfoCard } from './info-card';

export function LeisureCard({ leisure }: { leisure: LeisureInfo }) {
  return (
    <InfoCard source={leisure.source} title={leisure.title}>
      <View style={styles.list}>
        {leisure.items.map(({ label, percentage }) => (
          <View
            accessibilityLabel={label}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percentage, text: `${percentage}%` }}
            key={label}
            style={styles.item}>
            <View style={styles.row}>
              <Text numberOfLines={1} style={styles.label}>
                {label}
              </Text>
              <Text style={styles.value}>{percentage}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, percentage))}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  item: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  label: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 11,
  },
  value: {
    color: BrandColors.textPrimary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: BrandColors.primary,
  },
});
