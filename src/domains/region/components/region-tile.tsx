import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';

import { BrandColors } from '@/shared/constants/colors';

/** Points of a star polygon inside a 100×100 box. */
function starPoints(tips: number, innerRadius: number): string {
  return Array.from({ length: tips * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? 50 : innerRadius;
    const angle = (Math.PI / tips) * index - Math.PI / 2;
    return `${50 + radius * Math.cos(angle)},${50 + radius * Math.sin(angle)}`;
  }).join(' ');
}

const BURST = starPoints(8, 24);
const SPARKLE = 'M50 0C54 36 64 46 100 50C64 54 54 64 50 100C46 64 36 54 0 50C36 46 46 36 50 0Z';
const HALF_CIRCLE = 'M0 50A50 50 0 0 1 100 50Z';

const SHAPES = [
  { rotate: '12deg', render: (color: string) => <Polygon fill={color} points={BURST} /> },
  { rotate: '0deg', render: (color: string) => <Path d={SPARKLE} fill={color} /> },
  {
    rotate: '-14deg',
    render: (color: string) => (
      <Polygon
        fill={color}
        points="50,12 88,40 74,86 26,86 12,40"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={18}
      />
    ),
  },
  { rotate: '35deg', render: (color: string) => <Path d={HALF_CIRCLE} fill={color} /> },
];

/** Same region always gets the same shape. */
function shapeIndexFor(slug: string): number {
  return [...slug].reduce((total, char) => total + char.charCodeAt(0), 0) % SHAPES.length;
}

interface RegionTileProps {
  name: string;
  slug: string;
  /** Pink and olive tiles alternate like a checkerboard. */
  tone: 'pink' | 'olive';
  onPress: () => void;
}

export function RegionTile({ name, slug, tone, onPress }: RegionTileProps) {
  const shape = SHAPES[shapeIndexFor(slug)];
  const isPink = tone === 'pink';

  return (
    <Pressable
      accessibilityHint="Abre os detalhes da região"
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: isPink ? BrandColors.secondary : BrandColors.olive },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.shape, { transform: [{ rotate: shape.rotate }] }]}>
        <Svg height="100%" viewBox="0 0 100 100" width="100%">
          {shape.render(isPink ? BrandColors.primary : BrandColors.oliveDark)}
        </Svg>
      </View>
      <Text numberOfLines={2} style={styles.name}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 1.85,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 12,
    borderRadius: 16,
  },
  shape: {
    position: 'absolute',
    right: -18,
    bottom: -14,
    width: 92,
    height: 92,
  },
  name: {
    color: BrandColors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
