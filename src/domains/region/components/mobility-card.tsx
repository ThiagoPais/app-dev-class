import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import type { MobilityInfo, TransportMode } from '../models/region.types';
import { InfoCard } from './info-card';

const MODE_ICONS: Record<TransportMode, keyof typeof Ionicons.glyphMap> = {
  metro: 'train',
  bus: 'bus',
  bike: 'bicycle',
};

export function MobilityCard({ mobility }: { mobility: MobilityInfo }) {
  return (
    <InfoCard source={mobility.source} title={mobility.title}>
      <Text style={styles.summary}>{mobility.summary}</Text>
      <View style={styles.modes}>
        {mobility.modes.map(({ mode, label, available }) => (
          <View
            accessibilityLabel={`${label}: ${available ? 'disponível' : 'indisponível'}`}
            accessible
            key={mode}
            style={styles.mode}>
            <Ionicons
              color={available ? BrandColors.olive : BrandColors.textMuted}
              name={MODE_ICONS[mode]}
              size={22}
            />
            <Text style={styles.modeLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  summary: {
    color: BrandColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mode: {
    alignItems: 'center',
    gap: 4,
  },
  modeLabel: {
    color: BrandColors.textSecondary,
    fontSize: 11,
  },
});
