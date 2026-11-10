import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { BrandColors } from '@/shared/constants/colors';
import { SCREEN_MAX_WIDTH } from '@/shared/constants/layout';
import { showAlert } from '@/shared/utils/dialogs';

import { RegionTile } from '../components/region-tile';
import { useRegionSearch } from '../hooks/use-region-search';

const COLUMNS = 2;
/** Room for the floating tab bar. */
const TAB_BAR_SPACE = 96;

export function RegionSearchScreen() {
  const { bottom } = useSafeAreaInsets();
  const { regions, search, setSearch } = useRegionSearch();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title}>
              Pesquisar
            </Text>
            <Text style={styles.subtitle}>regiões administrativas do DF</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => showAlert('Filtros', 'Os filtros de busca chegam em breve.')}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
            <Ionicons color={BrandColors.white} name="options-outline" size={16} />
            <Text style={styles.filterLabel}>Filtros</Text>
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Ionicons color={BrandColors.textSecondary} name="search" size={18} />
          <TextInput
            accessibilityLabel="Buscar região administrativa"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Buscar região administrativa..."
            placeholderTextColor={BrandColors.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
          {search ? (
            <Pressable accessibilityLabel="Limpar busca" hitSlop={8} onPress={() => setSearch('')}>
              <Ionicons color={BrandColors.textSecondary} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: Math.max(bottom, 13) + TAB_BAR_SPACE },
        ]}
        data={regions}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(region) => region.slug}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons color={BrandColors.textMuted} name="search-outline" size={36} />
            <Text style={styles.emptyText}>Nenhuma região encontrada para essa busca.</Text>
          </View>
        }
        numColumns={COLUMNS}
        renderItem={({ item, index }) => {
          const row = Math.floor(index / COLUMNS);
          const column = index % COLUMNS;
          return (
            <RegionTile
              name={item.name}
              onPress={() => router.push({ pathname: '/region/[slug]', params: { slug: item.slug } })}
              slug={item.slug}
              tone={(row + column) % 2 === 0 ? 'pink' : 'olive'}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: SCREEN_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: '#FEF9FA',
  },
  header: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: BrandColors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: BrandColors.textMuted,
    fontSize: 13,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BrandColors.primary,
  },
  filterLabel: {
    color: BrandColors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: BrandColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 15,
    padding: 0,
  },
  grid: {
    flexGrow: 1,
    gap: 10,
    paddingHorizontal: Spacing.three,
  },
  row: {
    gap: 10,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    color: BrandColors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
