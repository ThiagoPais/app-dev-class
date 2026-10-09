import { Ionicons } from '@expo/vector-icons';
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

import { Spacing } from '@/constants/theme';
import { MiniProfileSheet, type ChatContact } from '@/domains/chat';
import { BrandColors } from '@/shared/constants/colors';

import { CategoryChips } from '../components/category-chips';
import { ForumHeader } from '../components/forum-header';
import { PaginationFooter } from '../components/pagination-footer';
import { TopicCard } from '../components/topic-card';
import { getCategoryLabel, type ForumCategory } from '../constants/categories';
import { FORUM_CITIES } from '../constants/regions';
import { useTopicFeed } from '../hooks/use-topic-feed';

/**
 * Second level of the forum: the topics of a single RA, filterable by area.
 */
export function CityForumScreen({ city }: { city: string }) {
  const isKnownCity = (FORUM_CITIES as readonly string[]).includes(city);

  if (!isKnownCity) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
        <ForumHeader title="Fórum" />
        <EmptyState icon="alert-circle-outline" message="Esta RA não foi encontrada." />
      </SafeAreaView>
    );
  }

  return <CityForum city={city} />;
}

function CityForum({ city }: { city: string }) {
  const { bottom } = useSafeAreaInsets();
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [profileUser, setProfileUser] = useState<ChatContact | null>(null);
  const {
    topics,
    hasTopics,
    search,
    setSearch,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    errorMessage,
    refresh,
    loadMore,
    retry,
  } = useTopicFeed(city, category);

  const fabBottom = Math.max(bottom, 16) + 8;
  const isFiltered = Boolean(category || search.trim());
  const countLabel = `${topics.length}${hasMore ? '+' : ''} ${
    topics.length === 1 && !hasMore ? 'conversa' : 'conversas'
  }`;

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
          category
            ? `Ainda não há conversas sobre ${getCategoryLabel(category)} em ${city}. Que tal começar uma?`
            : `Ainda não há conversas em ${city}. Que tal começar a primeira?`
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ForumHeader title="Conversas" />

      <View style={styles.titleBlock}>
        <Text numberOfLines={1} style={styles.cityTitle}>
          {city}
        </Text>
        <Text style={styles.subtitle}>
          {isLoading ? ' ' : `${countLabel} ${isFiltered ? 'encontradas' : 'nesta região'}`}
        </Text>
      </View>

      <View style={styles.filters}>
        <View style={styles.searchBar}>
          <Ionicons color={BrandColors.textSecondary} name="search" size={18} />
          <TextInput
            onChangeText={setSearch}
            placeholder={`Pesquisar em ${city}...`}
            placeholderTextColor={BrandColors.textSecondary}
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

        <CategoryChips allLabel="Todas" onSelect={setCategory} selected={category} />
      </View>

      <FlatList
        contentContainerStyle={[styles.feedContent, { paddingBottom: fabBottom + 72 }]}
        data={errorMessage && !hasTopics ? [] : topics}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(topic) => topic.id}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          hasTopics ? (
            <PaginationFooter
              errorMessage={errorMessage}
              hasMore={hasMore}
              isLoading={isLoadingMore}
              onLoadMore={errorMessage ? retry : loadMore}
            />
          ) : null
        }
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
            onAuthorPress={() => setProfileUser({ id: item.authorId, ...item.authorSnapshot })}
            onPress={() =>
              router.push({ pathname: '/forum/[topicId]', params: { topicId: item.id } })
            }
            topic={item}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={styles.feed}
      />

      <Pressable
        accessibilityLabel={`Criar novo tópico em ${city}`}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/forum/new',
            params: category ? { city, category } : { city },
          })
        }
        style={({ pressed }) => [styles.fab, { bottom: fabBottom }, pressed && styles.fabPressed]}>
        <Ionicons color={BrandColors.white} name="pencil" size={22} />
      </Pressable>

      <MiniProfileSheet onClose={() => setProfileUser(null)} participant={profileUser} />
    </SafeAreaView>
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
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#FEF9FA',
  },
  titleBlock: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  cityTitle: {
    color: BrandColors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 2,
    color: BrandColors.textSecondary,
    fontSize: 14,
  },
  filters: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#EEEEEE',
  },
  searchInput: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 16,
    padding: 0,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
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
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
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
});
