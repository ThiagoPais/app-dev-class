import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors } from '@/shared/constants/colors';

export interface AppCheckboxProps {
  checked: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  children?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}

export function AppCheckbox({
  checked,
  onValueChange,
  label,
  children,
  containerStyle,
  labelStyle,
  disabled = false,
}: AppCheckboxProps) {
  return (
    <Pressable
      style={[styles.container, disabled && styles.disabled, containerStyle]}
      onPress={() => !disabled && onValueChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && (
          <Ionicons name="checkmark" size={14} color={BrandColors.white} />
        )}
      </View>
      {children ? (
        children
      ) : label ? (
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  disabled: {
    opacity: 0.6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: BrandColors.checkboxBorder,
    backgroundColor: BrandColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '500',
    color: BrandColors.textPrimary,
    flexShrink: 1,
  },
});
