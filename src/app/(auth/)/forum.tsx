import { Image } from 'expo-image';
import type { CSSProperties } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardFeed, type CardFeedProps } from '@/components/card-feed';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();

  const searchBar: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.two,
    alignSelf: 'stretch',
    marginTop: Spacing.four,
    padding: `${Spacing.two}px ${Spacing.three}px`,
    borderRadius: 999,
    backgroundColor: "#EEEEEE",
    cursor: 'text',
    marginBottom: Spacing.four,
  };

  const searchInput: CSSProperties = {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: theme.text,
    font: 'inherit',
    fontSize: 16,
    textAlign: 'left',
    padding: 0,
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <h1 style={heading}>Forum</h1>
        <p style={subtitle}>converse com moradores das RAs</p>

        <label style={searchBar}>
          <Image
            source={require('@/icones/search.svg')}
            style={styles.icon}
            tintColor={theme.textSecondary}
            contentFit="contain"
          />
          <input type="search" size={20} placeholder="Pesquisa Conversa..." style={searchInput} />
        </label>


        {feeds.map((feed) => (
          <CardFeed key={feed.id} {...feed} />
        ))}
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

const heading = { margin: 0, fontSize: 32, lineHeight: 1 };
const subtitle = { margin: 0, fontSize: 16, lineHeight: 1 };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
    marginTop: Spacing.five,
  },
  icon: {
    width: 18,
    height: 18,
  },
});
