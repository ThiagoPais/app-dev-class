import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

/** Goes back, or to the forum tab when the screen was opened directly (e.g. via URL). */
export function goBackToForum() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(logged)/(tabs)/forum');
  }
}

export function ForumHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Voltar"
        accessibilityRole="button"
        hitSlop={8}
        onPress={goBackToForum}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Ionicons color={BrandColors.textPrimary} name="chevron-back" size={22} />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons
        color={tone === 'danger' ? '#E53935' : BrandColors.textPrimary}
        name={icon}
        size={20}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  title: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  pressed: {
    backgroundColor: '#F1E6EA',
  },
});
