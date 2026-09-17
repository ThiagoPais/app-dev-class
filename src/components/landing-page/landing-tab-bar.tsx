import { TabTrigger } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandColors } from '@/shared/constants/colors';

import { useAuth } from '@/domains/auth/hooks/use-auth';
import { LandingTabButton } from './landing-tab-button';
import { LandingTabPlaceholder } from './landing-tab-placeholder';

export function LandingTabBar() {
  const { bottom } = useSafeAreaInsets();
  const { logout } = useAuth();

  return (
    <View style={[styles.wrapper, { bottom: Math.max(bottom, 13) }]}>
      <View style={styles.bar}>
        <TabTrigger name="landing" asChild>
          <LandingTabButton
            icon={{ ios: 'house.fill', android: 'home', web: 'home' }}
            label="Início"
          />
        </TabTrigger>
        <LandingTabPlaceholder
          icon={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          label="Buscar"
        />
        <TabTrigger name="forum" asChild>
          <LandingTabButton
            icon={{ ios: 'bubble.left', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
            label="Mensagens"
          />
        </TabTrigger>
        <Pressable onPress={logout}>
          <LandingTabPlaceholder
            icon={{ ios: 'person.circle', android: 'account_circle', web: 'account_circle' }}
            label="Perfil"
          />
        </Pressable>
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
    backgroundColor: BrandColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
});
