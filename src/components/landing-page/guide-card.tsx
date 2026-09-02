import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

export function GuideCard() {
  return (
    <View style={styles.card}>
      <Image
        accessibilityLabel="Chave na porta de um novo imóvel"
        contentFit="cover"
        source={require('@/assets/images/landing/guia-primeiro-imovel.jpg')}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          'rgba(142, 36, 86, 0)',
          'rgba(142, 36, 86, 0.58)',
          'rgba(142, 36, 86, 0.92)',
        ]}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        style={styles.gradient}
      />
      <Text style={styles.label}>Clique aqui para conferir nosso guia!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    height: 190,
    overflow: 'hidden',
    backgroundColor: '#E8D8C6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
  },
  gradient: {
    position: 'absolute',
    top: '35%',
    right: 0,
    bottom: 0,
    left: 0,
  },
  label: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    color: BrandColors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});
