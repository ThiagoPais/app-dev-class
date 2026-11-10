import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

export function TagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;

  return (
    <View style={styles.list}>
      {tags.map((tag) => (
        <View key={tag} style={styles.chip}>
          <Text style={styles.label}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: BrandColors.secondary,
  },
  label: {
    color: BrandColors.white,
    fontSize: 13,
    fontWeight: '500',
  },
});
