import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

export type InformationTileProps = {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
};

export function InformationTile({ icon, label }: InformationTileProps) {
  return (
    <View style={styles.tile}>
      <SymbolView name={icon} size={45} tintColor={BrandColors.white} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 124,
    height: 105,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 27,
    backgroundColor: BrandColors.primary,
    shadowColor: '#3E0923',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.26,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    color: BrandColors.white,
    fontSize: 13,
    fontWeight: '500',
  },
});
