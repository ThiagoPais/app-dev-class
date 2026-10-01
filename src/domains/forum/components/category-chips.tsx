import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import { FORUM_CATEGORIES, type ForumCategory } from '../constants/categories';

interface CategoryChipsProps {
  selected: ForumCategory | null;
  onSelect: (category: ForumCategory | null) => void;
  /** Label for the "no filter" chip; omit to hide it (e.g. in the topic form). */
  allLabel?: string;
}

export function CategoryChips({ selected, onSelect, allLabel }: CategoryChipsProps) {
  const options = [
    ...(allLabel ? [{ id: null, label: allLabel, icon: 'apps-outline' as const }] : []),
    ...FORUM_CATEGORIES,
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}>
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={option.id ?? 'all'}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              color={isSelected ? BrandColors.white : BrandColors.textSecondary}
              name={option.icon}
              size={15}
            />
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BrandColors.inputBorder,
    borderRadius: 999,
    backgroundColor: BrandColors.white,
  },
  chipSelected: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    color: BrandColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelSelected: {
    color: BrandColors.white,
  },
});
