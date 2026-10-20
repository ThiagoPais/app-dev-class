import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapeeiLogo } from '@/shared/components/logo';
import { BrandColors } from '@/shared/constants/colors';

type IoniconName = keyof typeof Ionicons.glyphMap;

const features: { icon: IoniconName; title: string; description: string }[] = [
  {
    icon: 'map-outline',
    title: 'Lorem ipsum',
    description: 'Dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Dolor sit amet',
    description: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  },
  {
    icon: 'people-outline',
    title: 'Consectetur elit',
    description: 'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
  },
];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(logged)/(tabs)/profile');
}

/** App presentation reached from the profile menu. */
export function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          hitSlop={8}
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons color={BrandColors.white} name="arrow-back" size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Sobre</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <MapeeiLogo width={140} />
          <Text style={styles.tagline}>Lorem ipsum dolor sit amet consectetur.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lorem ipsum</Text>
          <Text style={styles.paragraph}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dolor sit amet</Text>
          {features.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons color={BrandColors.primary} name={feature.icon} size={18} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.version}>Versão {version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#FEF9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.divider,
    backgroundColor: BrandColors.white,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#78951A',
  },
  headerTitle: {
    color: BrandColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  content: {
    gap: 16,
    padding: 22,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  tagline: {
    color: BrandColors.primary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  card: {
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    backgroundColor: BrandColors.white,
    shadowColor: '#6A3448',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  paragraph: {
    color: BrandColors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFE9F1',
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    color: BrandColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  featureDescription: {
    color: BrandColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  version: {
    color: BrandColors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
