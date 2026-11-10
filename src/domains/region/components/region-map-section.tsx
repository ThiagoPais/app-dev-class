import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import { useHeatmap } from '../hooks/use-heatmap';
import type { RegionLocation } from '../models/region.types';
import { DEFAULT_HEAT_COLORS, HEAT_PERIODS } from '../utils/heatmap';
import { RegionMap } from './region-map';

type IconName = keyof typeof Ionicons.glyphMap;

const SAMPLE_LABEL = 'Dados de exemplo';

function iconName(icon: string): IconName {
  return icon in Ionicons.glyphMap ? (icon as IconName) : 'layers-outline';
}

interface RegionMapSectionProps {
  slug: string;
  name: string;
  location: RegionLocation;
}

/**
 * Map of the RA with a heatmap switch. While it is on, chips below the map choose the layer
 * (popularity, safety, transport...) and the period of the day; both come from Firestore.
 */
export function RegionMapSection({ slug, name, location }: RegionMapSectionProps) {
  const heatmap = useHeatmap(slug);
  const { layer } = heatmap;
  const colors = layer?.colors ?? DEFAULT_HEAT_COLORS;

  return (
    <View style={styles.section}>
      <View style={styles.map}>
        <RegionMap colors={colors} location={location} name={name} points={heatmap.points} />

        <Pressable
          accessibilityLabel="Mostrar mapa de calor"
          accessibilityRole="switch"
          accessibilityState={{ checked: heatmap.isActive }}
          hitSlop={6}
          onPress={heatmap.toggle}
          style={({ pressed }) => [
            styles.toggle,
            heatmap.isActive && styles.toggleActive,
            pressed && styles.pressed,
          ]}>
          <Ionicons
            color={heatmap.isActive ? BrandColors.white : BrandColors.primary}
            name="flame-outline"
            size={14}
          />
          <Text style={[styles.toggleText, heatmap.isActive && styles.textActive]}>
            Mapa de calor
          </Text>
        </Pressable>

        {heatmap.isLoading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={BrandColors.primary} />
          </View>
        ) : null}

        {heatmap.isActive && layer ? (
          <View style={styles.legend}>
            <Text style={styles.legendText}>Baixa</Text>
            <View style={styles.legendBar}>
              {colors.map((color) => (
                <View key={color} style={[styles.legendStep, { backgroundColor: color }]} />
              ))}
            </View>
            <Text style={styles.legendText}>Alta</Text>
          </View>
        ) : null}
      </View>

      {heatmap.isActive && heatmap.errorMessage ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{heatmap.errorMessage}</Text>
          <Pressable accessibilityRole="button" hitSlop={6} onPress={heatmap.retry}>
            <Text style={styles.retry}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      {heatmap.isActive && !heatmap.isLoading && !heatmap.errorMessage && !layer ? (
        <Text style={styles.caption}>Esta região ainda não tem mapa de calor.</Text>
      ) : null}

      {heatmap.isActive && layer ? (
        <View style={styles.controls}>
          <ScrollView
            contentContainerStyle={styles.chips}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {heatmap.layers.map((item) => {
              const selected = item.id === layer.id;
              return (
                <Pressable
                  accessibilityLabel={`Camada: ${item.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item.id}
                  onPress={() => heatmap.selectLayer(item.id)}
                  style={[styles.chip, selected && styles.chipSelected]}>
                  <Ionicons
                    color={selected ? BrandColors.white : BrandColors.primary}
                    name={iconName(item.icon)}
                    size={14}
                  />
                  <Text style={[styles.chipText, selected && styles.textActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.periods}>
            {HEAT_PERIODS.map((item) => {
              const selected = item.id === heatmap.period;
              return (
                <Pressable
                  accessibilityLabel={`Horário: ${item.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item.id}
                  onPress={() => heatmap.setPeriod(item.id)}
                  style={[styles.period, selected && styles.periodSelected]}>
                  <Text style={[styles.periodText, selected && styles.textActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {layer.description ? <Text style={styles.caption}>{layer.description}</Text> : null}
          <View style={styles.sourceRow}>
            {layer.isSample ? (
              <View style={styles.sampleBadge}>
                <Text style={styles.sampleText}>{SAMPLE_LABEL}</Text>
              </View>
            ) : null}
            {layer.source && !(layer.isSample && layer.source === SAMPLE_LABEL) ? (
              <Text style={styles.source}>{layer.source}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  map: {
    height: 220,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#EEF0F2',
  },
  toggle: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BrandColors.white,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
  },
  toggleActive: {
    backgroundColor: BrandColors.primary,
  },
  toggleText: {
    color: BrandColors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  textActive: {
    color: BrandColors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  legend: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  legendText: {
    color: BrandColors.textSecondary,
    fontSize: 10,
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
  controls: {
    gap: 10,
  },
  chips: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BrandColors.primary,
    borderRadius: 999,
    backgroundColor: BrandColors.white,
  },
  chipSelected: {
    backgroundColor: BrandColors.primary,
  },
  chipText: {
    color: BrandColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  periods: {
    flexDirection: 'row',
    gap: 6,
  },
  period: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F6E9EF',
  },
  periodSelected: {
    backgroundColor: BrandColors.primary,
  },
  periodText: {
    color: BrandColors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  caption: {
    color: BrandColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sampleBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#FFF4D6',
  },
  sampleText: {
    color: '#8A6100',
    fontSize: 11,
    fontWeight: '600',
  },
  source: {
    color: BrandColors.textMuted,
    fontSize: 11,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: BrandColors.textSecondary,
    fontSize: 13,
  },
  retry: {
    color: BrandColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
