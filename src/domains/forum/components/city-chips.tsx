import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import { FORUM_CITIES } from '../constants/regions';

interface CityChipsProps {
  selected: string | null;
  onSelect: (city: string | null) => void;
  /** Label for the "no filter" chip; omit to hide it (e.g. in the topic form). */
  allLabel?: string;
}

export function CityChips({ selected, onSelect, allLabel }: CityChipsProps) {
  const options: (string | null)[] = allLabel ? [null, ...FORUM_CITIES] : [...FORUM_CITIES];

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}>
      {options.map((city) => {
        const isSelected = city === selected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={city ?? 'all'}
            onPress={() => onSelect(city)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {city ?? allLabel}
            </Text>
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
