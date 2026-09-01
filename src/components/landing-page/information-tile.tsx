import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { landingColors } from './colors';

export type InformationTileProps = {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
};

export function InformationTile({ icon, label }: InformationTileProps) {
  return (
    <View style={styles.tile}>
      <SymbolView name={icon} size={45} tintColor={landingColors.white} />
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
    backgroundColor: landingColors.berry,
    shadowColor: '#3E0923',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.26,
    shadowRadius: 4,
    elevation: 4,
  },
  label: {
    color: landingColors.white,
    fontSize: 13,
    fontWeight: '500',
  },
});
