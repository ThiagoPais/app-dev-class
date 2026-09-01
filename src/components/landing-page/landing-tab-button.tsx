import type { TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

type LandingTabButtonProps = TabTriggerSlotProps & {
  icon: SymbolName;
  label: string;
};

export function LandingTabButton({
  icon,
  isFocused,
  label,
  ...props
}: LandingTabButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.item,
        isFocused && styles.activeItem,
        pressed && styles.pressed,
      ]}>
      <SymbolView
        name={icon}
        size={26}
        tintColor={isFocused ? BrandColors.secondary : '#CDCDCD'}
      />
    </Pressable>
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
  activeItem: {
    borderWidth: 2,
    borderColor: BrandColors.secondary,
    backgroundColor: '#FFF4F7',
  },
  pressed: {
    opacity: 0.7,
  },
});
