import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

export function FeatureCard() {
  return (
    <View style={styles.card}>
      <Image
        accessibilityLabel="Vista aérea de Brasília"
        contentFit="cover"
        source={require('@/assets/images/landing/passeios-df.jpg')}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.shade} />
      <Text accessibilityElementsHidden style={styles.largeStar}>✹</Text>
      <Text accessibilityElementsHidden style={styles.smallStar}>★</Text>
      <Text style={styles.title}>Passeios{`\n`}no DF</Text>
      <View style={styles.pagination}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.activeDot]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    height: 226,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: '#073D3C',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  shade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(10, 16, 28, 0.14)',
  },
  largeStar: {
    position: 'absolute',
    top: 4,
    right: 16,
    color: BrandColors.secondary,
    fontSize: 73,
    lineHeight: 80,
    transform: [{ rotate: '-12deg' }],
  },
  smallStar: {
    position: 'absolute',
    top: 76,
    right: 8,
    color: '#DCE72C',
    fontSize: 38,
    lineHeight: 43,
    transform: [{ rotate: '8deg' }],
  },
  title: {
    position: 'absolute',
    left: 22,
    bottom: 31,
    color: BrandColors.white,
    fontSize: 35,
    fontWeight: '800',
    lineHeight: 37,
    letterSpacing: -1,
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: BrandColors.white,
  },
});
