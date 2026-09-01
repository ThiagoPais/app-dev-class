import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export function BrandLogo() {
  return (
    <View accessibilityLabel="Mapeei" style={styles.container}>
      <Image
        contentFit="contain"
        source={require('@/assets/images/landing/logo-mapeei.svg')}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 146,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
  },
  image: {
    width: 144,
    height: 82,
  },
});
