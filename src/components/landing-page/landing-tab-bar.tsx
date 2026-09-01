import { TabTrigger } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { landingColors } from './colors';
import { LandingTabButton } from './landing-tab-button';
import { LandingTabPlaceholder } from './landing-tab-placeholder';

export function LandingTabBar() {
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { bottom: Math.max(bottom, 13) }]}>
      <View style={styles.bar}>
        <TabTrigger name="landing" asChild>
          <LandingTabButton
            icon={{ ios: 'house.fill', android: 'home', web: 'home' }}
            label="Início"
          />
        </TabTrigger>
        <TabTrigger name="explore" asChild>
          <LandingTabButton
            icon={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            label="Buscar"
          />
        </TabTrigger>
        <LandingTabPlaceholder
          icon={{ ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
          label="Mensagens"
        />
        <LandingTabPlaceholder
          icon={{ ios: 'person.circle', android: 'account_circle', web: 'account_circle' }}
          label="Perfil"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  bar: {
    width: '82%',
    maxWidth: 340,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    borderRadius: 29,
    backgroundColor: landingColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
});
