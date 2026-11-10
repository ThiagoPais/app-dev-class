import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MapeeiLogo } from '@/shared/components/logo';
import { UserAvatar } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

type IoniconName = keyof typeof Ionicons.glyphMap;

const features: { icon: IoniconName; title: string; description: string }[] = [
  {
    icon: 'map-outline',
    title: 'Raio-X das regiões',
    description:
      'Segurança, mobilidade, lazer, renda e mapas de calor de cada região administrativa, com base em dados públicos.',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Fórum por região',
    description: 'Tópicos e respostas de moradores reais, organizados por RA e por categoria.',
  },
  {
    icon: 'people-outline',
    title: 'Conversa direta',
    description: 'Troque mensagens com outros usuários para tirar dúvidas sobre o dia a dia no bairro.',
  },
];

const developers: { name: string; github: string; avatarUrl: string }[] = [
  {
    name: 'Thiago Cardoso',
    github: 'https://github.com/ThiagoPais',
    avatarUrl: 'https://avatars.githubusercontent.com/u/34371661?v=4',
  },
  {
    name: 'Arthur Mota Furtado',
    github: 'https://github.com/BomDia12',
    avatarUrl: 'https://avatars.githubusercontent.com/u/63117167?v=4',
  },
  {
    name: 'Arthur Brasa',
    github: 'https://github.com/ArthurBrasa',
    avatarUrl: 'https://avatars.githubusercontent.com/u/66705986?v=4',
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
          <Text style={styles.tagline}>Conheça a região antes de se mudar.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>O que é o Mapeei</Text>
          <Text style={styles.paragraph}>
            O Mapeei ajuda quem vai morar no Distrito Federal a escolher onde viver. O app reúne
            dados públicos sobre segurança, transporte, lazer e custo de vida de cada região
            administrativa e os combina com relatos de moradores, para que você decida com mais
            confiança.
          </Text>
          <Text style={styles.paragraph}>
            Projeto desenvolvido na disciplina de desenvolvimento de aplicativos. As informações
            exibidas são de caráter informativo e podem estar desatualizadas.
          </Text>
          <Text style={styles.disclaimer}>Este app não possui garantias</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Funcionalidades</Text>
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Desenvolvedores</Text>
          {developers.map((developer) => (
            <Pressable
              accessibilityHint="Abre o perfil no GitHub"
              accessibilityLabel={`${developer.name}, GitHub`}
              accessibilityRole="link"
              key={developer.github}
              onPress={() => openBrowserAsync(developer.github)}
              style={({ pressed }) => [styles.developer, pressed && styles.pressed]}>
              <UserAvatar avatarUrl={developer.avatarUrl} name={developer.name} size={44} />
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{developer.name}</Text>
                <Text style={styles.developerLink}>{developer.github.replace('https://', '')}</Text>
              </View>
              <Ionicons color={BrandColors.textMuted} name="logo-github" size={20} />
            </Pressable>
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
  disclaimer: {
    color: BrandColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  developer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  developerLink: {
    color: BrandColors.primary,
    fontSize: 12,
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
