import { Image } from 'expo-image';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardFeed, type CardFeedProps } from '@/components/card-feed';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle">Forum</ThemedText>
        <ThemedText themeColor="textSecondary">converse com moradores das RAs</ThemedText>

        <View style={styles.searchBar}>
          <Image
            source={require('@/icones/search.svg')}
            style={styles.icon}
            tintColor={theme.textSecondary}
            contentFit="contain"
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Pesquisa Conversa..."
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
          />
        </View>

        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}>
          {feeds.map((feed) => (
            <CardFeed key={feed.id} {...feed} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const feeds: (CardFeedProps & { id: number })[] = [
  {
    id: 1,
    title: 'Obras na Ceilandia',
    description:
      'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Consequatur nulla quisquam facilis, esse eius vel molestias praesentium labore expedita velit.',
    conversations: 5,
    messages: 8,
    likes: 25,
    active: true,
    lastActivity: '45min',
  },
  {
    id: 2,
    title: 'Feira do Guara',
    description:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam facilis esse eius vel molestias praesentium.',
    conversations: 1,
    messages: 2,
    likes: 4,
    active: false,
    lastActivity: '3 dias',
  },
  {
    id: 3,
    title: 'Feira do Guara',
    description:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam facilis esse eius vel molestias praesentium.',
    conversations: 1,
    messages: 2,
    likes: 4,
    active: false,
    lastActivity: '3 dias',
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
    marginTop: Spacing.five,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
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
  feed: {
    alignSelf: 'stretch',
  },
  feedContent: {
    paddingBottom: Spacing.five,
  },
  icon: {
    width: 18,
    height: 18,
  },
});
