import { StyleSheet, View } from 'react-native';

import { MapeeiLogo } from '@/shared/components/logo';

export function BrandLogo() {
  return (
    <View accessibilityLabel="Mapeei" style={styles.container}>
      <MapeeiLogo width={144} />
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
});
