import React, { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors } from '@/shared/constants/colors';

export interface AppTextInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  isPassword?: boolean;
}

export function AppTextInput({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  isPassword = false,
  secureTextEntry,
  placeholderTextColor = BrandColors.placeholder,
  ...rest
}: AppTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = isPassword ? !showPassword : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          Boolean(error) && styles.inputWrapperError,
        ]}>
        <TextInput
          style={[styles.input, isPassword && styles.inputWithIcon, inputStyle]}
          placeholderTextColor={placeholderTextColor}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize={isPassword ? 'none' : rest.autoCapitalize}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            hitSlop={8}
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeButton}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={BrandColors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: BrandColors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.inputBackground,
    borderWidth: 1,
    borderColor: BrandColors.inputBorder,
    borderRadius: 25,
    height: 48,
    paddingHorizontal: 18,
  },
  inputWrapperFocused: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.white,
  },
  inputWrapperError: {
    borderColor: '#DC2626',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: BrandColors.textPrimary,
    height: '100%',
    padding: 0,
  },
  inputWithIcon: {
    paddingRight: 8,
  },
  eyeButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    marginLeft: 14,
  },
});
