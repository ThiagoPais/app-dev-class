import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { LandingTabBar } from '@/components/landing-page/landing-tab-bar';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <LandingTabBar />
      <TabList style={styles.routeList}>
        <TabTrigger name="home" href="/" />
        <TabTrigger name="landing" href="/ladingPage" />
        <TabTrigger name="explore" href="/explore" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  routeList: {
    display: 'none',
  },
});
