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
import { BrandColors } from '@/shared/constants/colors';

export interface AuthFooterLinkProps {
  promptText: string;
  actionText: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  actionStyle?: StyleProp<TextStyle>;
}

export function AuthFooterLink({
  promptText,
  actionText,
  onPress,
  style,
  textStyle,
  actionStyle,
}: AuthFooterLinkProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.promptText, textStyle]}>
        {promptText}{' '}
        <Text
          style={[styles.actionText, actionStyle]}
          onPress={onPress}
          suppressHighlighting={false}>
          {actionText}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  promptText: {
    fontSize: 14,
    fontWeight: '600',
    color: BrandColors.textPrimary,
    textAlign: 'center',
  },
  actionText: {
    color: BrandColors.secondary,
    fontWeight: '700',
  },
});
