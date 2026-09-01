import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyCopy } from '@/components/landing-page/body-copy';
import { BrandLogo } from '@/components/landing-page/brand-logo';
import { landingColors } from '@/components/landing-page/colors';
import { FeatureCard } from '@/components/landing-page/feature-card';
import { GuideCard } from '@/components/landing-page/guide-card';
import { EmphasizedCopy } from '@/components/landing-page/emphasized-copy';
import {
  InformationTile,
  type InformationTileProps,
} from '@/components/landing-page/information-tile';
import { SectionHeading } from '@/components/landing-page/section-heading';

const informationTiles: InformationTileProps[] = [
  {
    label: 'Segurança',
    icon: { ios: 'person.badge.shield.checkmark', android: 'shield_person', web: 'shield_person' },
  },
  {
    label: 'Transporte',
    icon: { ios: 'bus', android: 'directions_bus', web: 'directions_bus' },
  },
  {
    label: 'Lazer',
    icon: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  },
  {
    label: 'Mercado',
    icon: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
  },
];

export default function LandingPage() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BrandLogo />
          <FeatureCard />

          <SectionHeading
            subtitle="clique no card para navegar pelas informações"
            title="Para saber mais"
          />

          <ScrollView
            contentContainerStyle={styles.informationList}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {informationTiles.map((tile) => (
              <InformationTile key={tile.label} {...tile} />
            ))}
          </ScrollView>

          <View style={styles.copyBlock}>
            <BodyCopy>
              Para ajudar você a tomar decisões com mais confiança, reunimos informações de{' '}
              <EmphasizedCopy>fontes oficiais e dados públicos</EmphasizedCopy> sobre segurança,
              transporte, comércio/lazer e custo de vida, juntamente dos{' '}
              <EmphasizedCopy>relatos de moradores reais!</EmphasizedCopy>
            </BodyCopy>
            <BodyCopy>
              Navegue por dados destrinchados e fáceis de entender, e sinta-se com repertório sobre
              o contexto local das diferentes regiões do Brasil.
            </BodyCopy>
          </View>

          <Text style={styles.largeTitle}>Morando sozinho pela{`\n`}primeira vez?</Text>
          <GuideCard />
          <BodyCopy>
            Nosso guia reúne dicas práticas, checklists, explicações de termos comuns do mercado
            imobiliário e orientações para ajudar você a se preparar com mais segurança e
            tranquilidade para essa nova fase.
          </BodyCopy>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: landingColors.background,
  },
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: landingColors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 116,
  },
  informationList: {
    gap: 14,
    paddingTop: 16,
    paddingBottom: 17,
    paddingHorizontal: 1,
  },
  copyBlock: {
    paddingHorizontal: 14,
    gap: 12,
  },
  largeTitle: {
    marginTop: 19,
    marginBottom: 15,
    paddingHorizontal: 4,
    color: landingColors.ink,
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.6,
  },
});
