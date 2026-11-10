import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTopCityTopics } from '@/domains/forum';
import { AppButton } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';
import { SCREEN_MAX_WIDTH } from '@/shared/constants/layout';

import { ForumHighlightCard } from '../components/forum-highlight-card';
import { IncomeCard } from '../components/income-card';
import { LeisureCard } from '../components/leisure-card';
import { MobilityCard } from '../components/mobility-card';
import { PhotoGallery } from '../components/photo-gallery';
import { RegionHeader, RegionHeaderAction } from '../components/region-header';
import { RegionMap } from '../components/region-map';
import { SafetyCard } from '../components/safety-card';
import { SurroundingsCard } from '../components/surroundings-card';
import { TagChips } from '../components/tag-chips';
import { useRegionDetails } from '../hooks/use-region-details';
import type { RegionDetails } from '../models/region.types';
import { listRegions } from '../services/region.service';

export function RegionDetailScreen({ slug }: { slug: string }) {
  const { region, isLoading, errorMessage, retry } = useRegionDetails(slug);
  const fallbackName = listRegions().find((entry) => entry.slug === slug)?.name ?? 'Região';

  if (region) {
    return <RegionDetail region={region} />;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <RegionHeader title={fallbackName} />
      {isLoading ? (
        <ActivityIndicator color={BrandColors.primary} style={styles.loading} />
      ) : (
        <View style={styles.empty}>
          <Ionicons
            color={BrandColors.textMuted}
            name={errorMessage ? 'cloud-offline-outline' : 'map-outline'}
            size={36}
          />
          <Text style={styles.emptyText}>
            {errorMessage ?? 'Ainda não temos dados sobre esta região. Volte em breve!'}
          </Text>
          {errorMessage ? (
            <AppButton onPress={retry} style={styles.retry} title="Tentar novamente" variant="outline" />
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function RegionDetail({ region }: { region: RegionDetails }) {
  const { bottom } = useSafeAreaInsets();
  const [isFavorite, setIsFavorite] = useState(false);
  const {
    topics,
    isLoading: isLoadingTopics,
    errorMessage: topicsError,
  } = useTopCityTopics(region.forumCity);
  const hasCategories = Boolean(
    region.mobility || region.surroundings || region.leisure || region.income || region.safety
  );

  const share = async () => {
    try {
      await Share.share({
        message: region.description ? `${region.name}: ${region.description}` : region.name,
      });
    } catch {
      // Sharing is unavailable in some browsers; nothing to recover.
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <RegionHeader
        right={
          <>
            <RegionHeaderAction
              color={isFavorite ? BrandColors.primary : BrandColors.textPrimary}
              icon={isFavorite ? 'heart' : 'heart-outline'}
              label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              onPress={() => setIsFavorite((current) => !current)}
            />
            <RegionHeaderAction icon="share-social-outline" label="Compartilhar" onPress={share} />
          </>
        }
        title={region.name}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottom, 16) + 8 }]}
        showsVerticalScrollIndicator={false}>
        <PhotoGallery photos={region.photos} />
        {region.tags.length ? <TagChips tags={region.tags} /> : null}
        {region.description ? <Text style={styles.description}>{region.description}</Text> : null}

        {hasCategories ? <SectionTitle>Principais categorias</SectionTitle> : null}
        {region.mobility || region.surroundings || region.leisure ? (
          <View style={styles.columns}>
            {region.mobility || region.surroundings ? (
              <View style={[styles.column, styles.narrowColumn]}>
                {region.mobility ? <MobilityCard mobility={region.mobility} /> : null}
                {region.surroundings ? (
                  <SurroundingsCard surroundings={region.surroundings} />
                ) : null}
              </View>
            ) : null}
            {region.leisure ? (
              <View style={[styles.column, styles.wideColumn]}>
                <LeisureCard leisure={region.leisure} />
              </View>
            ) : null}
          </View>
        ) : null}
        {region.income ? <IncomeCard income={region.income} regionName={region.name} /> : null}
        {region.safety ? <SafetyCard safety={region.safety} /> : null}

        <SectionTitle>Localização</SectionTitle>
        <RegionMap location={region.location} name={region.name} popularity={region.popularity} />
        {region.popularity?.source ? (
          <Text style={styles.source}>Popularidade: {region.popularity.source}</Text>
        ) : null}

        {!hasCategories ? (
          <Text style={styles.pending}>
            Ainda estamos reunindo os indicadores desta região. Enquanto isso, veja o que os
            moradores contam no fórum.
          </Text>
        ) : null}

        <SectionTitle>Destaques do fórum</SectionTitle>
        {isLoadingTopics ? <ActivityIndicator color={BrandColors.primary} /> : null}
        {!isLoadingTopics && !topics.length ? (
          <Text style={styles.pending}>
            {topicsError ?? 'Ninguém publicou sobre esta região ainda. Que tal começar?'}
          </Text>
        ) : null}
        {topics.map((topic) => (
          <ForumHighlightCard
            highlight={{
              id: topic.id,
              authorName: topic.authorSnapshot.fullName,
              avatarUrl: topic.authorSnapshot.avatarUrl,
              votes: topic.netVotes,
              title: topic.title,
              content: topic.content,
            }}
            key={topic.id}
            onPress={() =>
              router.push({ pathname: '/forum/[topicId]', params: { topicId: topic.id } })
            }
          />
        ))}

        <AppButton
          onPress={() =>
            router.push({ pathname: '/forum/ra/[city]', params: { city: region.forumCity } })
          }
          style={styles.forumButton}
          textStyle={styles.forumButtonText}
          title="Ver fórum completo"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: SCREEN_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: BrandColors.background,
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
  },
  description: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    lineHeight: 24,
  },
  sectionTitle: {
    marginTop: Spacing.two,
    color: BrandColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  column: {
    gap: 10,
  },
  narrowColumn: {
    flex: 9,
  },
  wideColumn: {
    flex: 11,
  },
  source: {
    marginTop: -Spacing.two,
    color: BrandColors.textMuted,
    fontSize: 11,
  },
  pending: {
    color: BrandColors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  forumButton: {
    height: 52,
    marginTop: Spacing.two,
    borderRadius: 26,
  },
  forumButtonText: {
    fontWeight: '500',
  },
  loading: {
    marginTop: Spacing.six,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    color: BrandColors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  retry: {
    width: 'auto',
  },
});
