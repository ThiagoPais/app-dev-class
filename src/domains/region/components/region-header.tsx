import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

/** Goes back, or to the search tab when the page was opened directly (e.g. via URL). */
function goBackToSearch() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(logged)/(tabs)/search');
  }
}

export function RegionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Voltar"
        accessibilityRole="button"
        hitSlop={8}
        onPress={goBackToSearch}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Ionicons color={BrandColors.white} name="arrow-back" size={20} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function RegionHeaderAction({
  icon,
  label,
  onPress,
  color = BrandColors.textPrimary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Ionicons color={color} name={icon} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: BrandColors.olive,
  },
  title: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  action: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  pressed: {
    opacity: 0.7,
  },
});
