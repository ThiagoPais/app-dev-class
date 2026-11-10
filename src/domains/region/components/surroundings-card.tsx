import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import type { SurroundingsInfo } from '../models/region.types';
import { InfoCard } from './info-card';

export function SurroundingsCard({ surroundings }: { surroundings: SurroundingsInfo }) {
  return (
    <InfoCard source={surroundings.source} title={surroundings.title}>
      <View style={styles.list}>
        {surroundings.items.map((item) => (
          <View key={item} style={styles.item}>
            <Ionicons color={BrandColors.olive} name="checkmark-circle" size={16} />
            <Text style={styles.label}>{item}</Text>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 12,
  },
});
