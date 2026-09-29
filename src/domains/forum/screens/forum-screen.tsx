import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
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

import { CityChips } from '../components/city-chips';
import { PaginationFooter } from '../components/pagination-footer';
import { TopicCard } from '../components/topic-card';
import { useTopicFeed } from '../hooks/use-topic-feed';

/** Space kept free at the bottom for the floating tab bar. */
const TAB_BAR_SPACE = 84;

export function ForumScreen() {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [city, setCity] = useState<string | null>(null);
  const { topics, hasTopics, search, setSearch, isLoading, isRefreshing, isLoadingMore, hasMore, errorMessage, refresh, loadMore, retry } =
    useTopicFeed(city);

  const tabBarOffset = Math.max(bottom, 13) + TAB_BAR_SPACE;

  const renderEmpty = () => {
    if (isLoading) {
      return <ActivityIndicator color={BrandColors.primary} style={styles.loading} />;
    }
    if (errorMessage) {
      return <EmptyState icon="cloud-offline-outline" message={errorMessage} />;
    }
    if (search.trim()) {
      return <EmptyState icon="search-outline" message="Nenhum tópico encontrado para essa busca." />;
    }
    return (
      <EmptyState
        icon="chatbubbles-outline"
        message={
          city
            ? `Ainda não há conversas sobre ${city}. Que tal começar uma?`
            : 'Ainda não há conversas. Que tal começar a primeira?'
        }
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.content}>
        <ThemedText type="subtitle">Forum</ThemedText>
        <ThemedText themeColor="textSecondary">converse com moradores das RAs</ThemedText>

        <View style={styles.searchBar}>
          <Image
            contentFit="contain"
            source={require('@/icones/search.svg')}
            style={styles.icon}
            tintColor={theme.textSecondary}
          />
          <TextInput
            onChangeText={setSearch}
            placeholder="Pesquisa Conversa..."
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

        <View style={styles.chips}>
          <CityChips allLabel="Todas as RAs" onSelect={setCity} selected={city} />
        </View>

        <FlatList
          contentContainerStyle={[styles.feedContent, { paddingBottom: tabBarOffset + 72 }]}
          data={errorMessage && !hasTopics ? [] : topics}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(topic) => topic.id}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={hasTopics ? (
            <PaginationFooter isLoading={isLoadingMore} hasMore={hasMore}
              errorMessage={errorMessage} onLoadMore={errorMessage ? retry : loadMore} />
          ) : null}
          onEndReached={errorMessage ? undefined : loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              colors={[BrandColors.primary]}
              onRefresh={refresh}
              refreshing={isRefreshing}
              tintColor={BrandColors.primary}
            />
          }
          renderItem={({ item }) => (
            <TopicCard
              onPress={() =>
                router.push({ pathname: '/forum/[topicId]', params: { topicId: item.id } })
              }
              topic={item}
            />
          )}
          showsVerticalScrollIndicator={false}
          style={styles.feed}
        />
      </SafeAreaView>

      <Pressable
        accessibilityLabel="Criar novo tópico"
        accessibilityRole="button"
        onPress={() => router.push('/forum/new')}
        style={({ pressed }) => [styles.fab, { bottom: tabBarOffset }, pressed && styles.fabPressed]}>
        <Ionicons color={BrandColors.white} name="add" size={22} />
        <Text style={styles.fabText}>Novo tópico</Text>
      </Pressable>
    </ThemedView>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons color={BrandColors.textMuted} name={icon} size={36} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
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
  chips: {
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  feed: {
    alignSelf: 'stretch',
  },
  feedContent: {
    flexGrow: 1,
  },
  icon: {
    width: 18,
    height: 18,
  },
  loading: {
    marginTop: Spacing.six,
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
  fab: {
    position: 'absolute',
    right: 20,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: BrandColors.primary,
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.88,
  },
  fabText: {
    color: BrandColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
