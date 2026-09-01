import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

type LandingTabPlaceholderProps = {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
};

export function LandingTabPlaceholder({ icon, label }: LandingTabPlaceholderProps) {
  return (
    <View accessibilityLabel={label} style={styles.item}>
      <SymbolView name={icon} size={26} tintColor="#CDCDCD" />
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
});
