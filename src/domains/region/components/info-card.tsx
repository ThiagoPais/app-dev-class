import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

interface InfoCardProps {
  title: string;
  /** Data source shown as a footnote, e.g. "PDAD 2021". */
  source?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Bordered card used by every data block of the region page. */
export function InfoCard({ title, source, children, style }: InfoCardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
      {source ? <Text style={styles.source}>{source}</Text> : null}
    </View>
  );
}

export const infoCardStyles = StyleSheet.create({
  footnote: {
    color: BrandColors.textMuted,
    fontSize: 11,
  },
});

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    borderRadius: 20,
    backgroundColor: BrandColors.white,
  },
  title: {
    color: BrandColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  source: {
    ...infoCardStyles.footnote,
    marginTop: 'auto',
  },
});
