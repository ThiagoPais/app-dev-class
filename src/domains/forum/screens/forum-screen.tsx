import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BrandColors } from '@/shared/constants/colors';

import { CityCard } from '../components/city-card';
import { useCityOverview } from '../hooks/use-city-overview';
import { normalizeCityName } from '../services/forum.service';

/** Space kept free at the bottom for the floating tab bar. */
const TAB_BAR_SPACE = 84;

/**
 * First level of the forum: one card per RA with its latest activity. Each RA
 * has its own forum, opened in CityForumScreen, where topics are filtered by area.
 */
export function ForumScreen() {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const { cities, isLoading, isRefreshing, errorMessage, refresh } = useCityOverview();

  const visibleCities = useMemo(() => {
    const term = normalizeCityName(search);
    return term ? cities.filter(({ city }) => normalizeCityName(city).includes(term)) : cities;
  }, [cities, search]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.content}>
        <ThemedText type="subtitle">Fórum</ThemedText>
        <ThemedText themeColor="textSecondary">converse com moradores das RAs</ThemedText>

        <View style={styles.searchBar}>
          <Image
            contentFit="contain"
            source={require('@/icones/search.svg')}
            style={styles.icon}
            tintColor={theme.textSecondary}
          />
          <TextInput
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Buscar região administrativa..."
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
          />
          {search ? (
            <Pressable accessibilityLabel="Limpar busca" hitSlop={8} onPress={() => setSearch('')}>
              <Ionicons color={theme.textSecondary} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={BrandColors.primary} style={styles.loading} />
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: Math.max(bottom, 13) + TAB_BAR_SPACE }}
            data={visibleCities}
            keyboardShouldPersistTaps="handled"
            keyExtractor={({ city }) => city}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons color={BrandColors.textMuted} name="search-outline" size={36} />
                <Text style={styles.emptyText}>Nenhuma RA encontrada para essa busca.</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                colors={[BrandColors.primary]}
                onRefresh={refresh}
                refreshing={isRefreshing}
                tintColor={BrandColors.primary}
              />
            }
            renderItem={({ item }) => (
              <CityCard
                onPress={() =>
                  router.push({ pathname: '/forum/ra/[city]', params: { city: item.city } })
                }
                overview={item}
              />
            )}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
    paddingTop: Spacing.five,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#EEEEEE',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  icon: {
    width: 18,
    height: 18,
  },
  list: {
    alignSelf: 'stretch',
  },
  loading: {
    marginTop: Spacing.six,
  },
  error: {
    marginBottom: Spacing.two,
    color: '#DC2626',
    fontSize: 13,
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
});
