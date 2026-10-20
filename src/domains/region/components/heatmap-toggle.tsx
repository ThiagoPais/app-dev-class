import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import { HEAT_PERIODS, type HeatPeriod } from '../utils/heat-points';

interface HeatmapToggleProps {
  active: boolean;
  onToggle: () => void;
  period: HeatPeriod;
  onPeriodChange: (period: HeatPeriod) => void;
}

/** Chip pinned over the map that switches the popularity heatmap, with a legend while on. */
export function HeatmapToggle({ active, onToggle, period, onPeriodChange }: HeatmapToggleProps) {
  return (
    <>
      <Pressable
        accessibilityLabel="Mostrar mapa de calor de popularidade"
        accessibilityRole="switch"
        accessibilityState={{ checked: active }}
        hitSlop={6}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.chip,
          active && styles.chipActive,
          pressed && styles.pressed,
        ]}>
        <Ionicons
          color={active ? BrandColors.white : BrandColors.primary}
          name="flame-outline"
          size={13}
        />
        <Text style={[styles.chipText, active && styles.chipTextActive]}>Popularidade</Text>
      </Pressable>

      {active ? (
        <View style={styles.periods}>
          {HEAT_PERIODS.map((item) => {
            const selected = item.id === period;
            return (
              <Pressable
                key={item.id}
                accessibilityLabel={`Horário: ${item.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                hitSlop={4}
                onPress={() => onPeriodChange(item.id)}
                style={[styles.period, selected && styles.periodSelected]}>
                <Text style={[styles.periodText, selected && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {active ? (
        <View pointerEvents="none" style={styles.legend}>
          <Text style={styles.legendText}>Baixa</Text>
          <View style={styles.legendBar}>
            {['#F7C6D6', '#E96E97', '#B83A6B', '#832D51'].map((color) => (
              <View key={color} style={[styles.legendStep, { backgroundColor: color }]} />
            ))}
          </View>
          <Text style={styles.legendText}>Alta</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BrandColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  chipActive: {
    backgroundColor: BrandColors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  chipText: {
    color: BrandColors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: BrandColors.white,
  },
  periods: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
  },
  period: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  periodSelected: {
    backgroundColor: BrandColors.primary,
  },
  periodText: {
    color: BrandColors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  legendText: {
    color: BrandColors.textSecondary,
    fontSize: 9,
  },
  legendBar: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 3,
  },
  legendStep: {
    width: 14,
    height: 6,
  },
});
