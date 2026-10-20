import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { IncomeChart } from '../components/income-chart';
import { RegionCard } from '../components/region-card';
import { RegionMap } from '../components/region-map';
import { SafetyChart } from '../components/safety-chart';
import { DF_CENTER, REGION_COORDINATES } from '../constants';
import { REGION_DETAILS_MOCK } from '../mocks/region.mock';

const PHOTO_COLORS = ['#9FB1A0', '#D9C77A', '#7FA3B8'];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(logged)/(tabs)/forum');
}

/** Overview of one RA (photos, indicators and forum highlights), still on mocked data. */
export function RegionDetailScreen({ city }: { city: string }) {
  const { bottom } = useSafeAreaInsets();
  const details = REGION_DETAILS_MOCK;

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
        <Text numberOfLines={1} style={styles.headerTitle}>
          {city}
        </Text>
        {/* <Ionicons color={BrandColors.textPrimary} name="heart-outline" size={20} />
        <Ionicons color={BrandColors.textPrimary} name="share-social-outline" size={20} /> */}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.gallery}>
          <View style={[styles.photo, styles.photoMain, { backgroundColor: PHOTO_COLORS[0] }]}>
            <Ionicons color={BrandColors.white} name="image-outline" size={32} />
          </View>
          <View style={styles.photoColumn}>
            <View style={[styles.photo, styles.photoSmall, { backgroundColor: PHOTO_COLORS[1] }]} />
            <View style={[styles.photo, styles.photoSmall, { backgroundColor: PHOTO_COLORS[2] }]}>
              <View style={styles.photoOverlay}>
                <Text style={styles.photoOverlayText}>+{details.extraPhotos} fotos</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tags}>
          {details.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.description}>{details.description}</Text>

        <Text style={styles.sectionTitle}>Principais categorias</Text>
        <View style={styles.columns}>
          <View style={styles.column}>
            <RegionCard title="Mobilidade">
              <Text style={styles.smallText}>{details.mobility.text}</Text>
              <View style={styles.modes}>
                {details.mobility.modes.map((mode) => (
                  <View key={mode.label} style={styles.mode}>
                    <Ionicons color={BrandColors.primary} name={mode.icon} size={16} />
                    <Text style={styles.modeLabel}>{mode.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.source}>{details.mobility.source}</Text>
            </RegionCard>

            <RegionCard title={details.residents.title}>
              {details.residents.items.map((item) => (
                <View key={item} style={styles.checkRow}>
                  <Ionicons color="#4C9A2A" name="checkmark-circle" size={13} />
                  <Text style={styles.smallText}>{item}</Text>
                </View>
              ))}
              <Text style={styles.source}>PDAD 2021</Text>
            </RegionCard>
          </View>

          <View style={styles.column}>
            <RegionCard title="Lazer">
              {details.leisure.map((item) => (
                <View key={item.label} style={styles.leisureRow}>
                  <View style={styles.leisureHeader}>
                    <Text numberOfLines={1} style={styles.leisureLabel}>
                      {item.label}
                    </Text>
                    <Text style={styles.leisureValue}>{item.percent}%</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${item.percent}%` }]} />
                  </View>
                </View>
              ))}
              <Text style={styles.source}>PDAD 2021</Text>
            </RegionCard>
          </View>
        </View>

        <RegionCard title="Rendimento domiciliar">
          <Text style={styles.smallText}>{details.income.summary}</Text>
          <IncomeChart bars={details.income.bars} />
          <Text style={styles.source}>{details.income.source}</Text>
        </RegionCard>

        <RegionCard title="Segurança">
          <SafetyChart series={details.safety.series} />
          <Text style={styles.source}>{details.safety.note}</Text>
        </RegionCard>

        <Text style={styles.sectionTitle}>Localização</Text>
        <RegionMap city={city} coordinates={REGION_COORDINATES[city] ?? DF_CENTER} />

        <Text style={styles.sectionTitle}>Destaques do fórum</Text>
        {details.forumHighlights.map((post) => (
          <RegionCard key={post.id}>
            <View style={styles.postHeader}>
              <UserAvatar avatarUrl={null} name={post.author} size={26} />
              <Text style={styles.postAuthor}>{post.author}</Text>
              <Ionicons color={BrandColors.textMuted} name="heart-outline" size={12} />
              <Text style={styles.postLikes}>{post.likes}</Text>
            </View>
            <Text style={styles.postText}>{post.text}</Text>
          </RegionCard>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/forum/ra/[city]', params: { city } })}
          style={({ pressed }) => [styles.forumButton, pressed && styles.pressed]}>
          <Text style={styles.forumButtonText}>Ver fórum completo</Text>
        </Pressable>
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
    backgroundColor: BrandColors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#78951A',
  },
  headerTitle: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  content: {
    gap: 14,
    paddingHorizontal: 16,
  },
  gallery: {
    flexDirection: 'row',
    gap: 6,
    height: 150,
  },
  photo: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  photoMain: {
    flex: 2,
  },
  photoColumn: {
    flex: 1,
    gap: 6,
  },
  photoSmall: {
    flex: 1,
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  photoOverlayText: {
    color: BrandColors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BrandColors.secondary,
  },
  tagText: {
    color: BrandColors.white,
    fontSize: 10,
    fontWeight: '500',
  },
  description: {
    color: BrandColors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    marginTop: 4,
    color: BrandColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  column: {
    flex: 1,
    gap: 10,
  },
  smallText: {
    color: BrandColors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  source: {
    color: BrandColors.textMuted,
    fontSize: 8,
  },
  modes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mode: {
    alignItems: 'center',
    gap: 2,
  },
  modeLabel: {
    color: BrandColors.textSecondary,
    fontSize: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leisureRow: {
    gap: 3,
  },
  leisureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  leisureLabel: {
    flexShrink: 1,
    color: BrandColors.textPrimary,
    fontSize: 9,
  },
  leisureValue: {
    color: BrandColors.textPrimary,
    fontSize: 9,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#F0D9E2',
  },
  fill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: BrandColors.primary,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postAuthor: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  postLikes: {
    color: BrandColors.textMuted,
    fontSize: 11,
  },
  postText: {
    color: BrandColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  forumButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: BrandColors.primary,
  },
  forumButtonText: {
    color: BrandColors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
