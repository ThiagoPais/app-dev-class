import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BrandColors } from '@/shared/constants/colors';

export interface OrDividerProps {
  text?: string;
  style?: StyleProp<ViewStyle>;
}

export function OrDivider({ text = 'Ou', style }: OrDividerProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.line} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  text: {
    paddingHorizontal: 12,
    fontSize: 14,
    color: BrandColors.textPrimary,
    fontWeight: '500',
  },
});
