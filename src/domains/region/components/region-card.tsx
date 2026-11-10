import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

/** White rounded card with an optional bold title, shared by every region block. */
export function RegionCard({
  children,
  style,
  title,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDDDDD',
    borderRadius: 12,
    backgroundColor: BrandColors.white,
  },
  title: {
    color: BrandColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
