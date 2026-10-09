import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { ChatRow } from '../components/chat-row';
import { useUserChats } from '../hooks/use-user-chats';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(logged)/(tabs)/profile');
}

/** Every chat the signed-in user is in, newest activity first. */
export function ChatListScreen() {
  const chats = useUserChats();

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
        <Text style={styles.headerTitle}>Conversas</Text>
      </View>

      {chats.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BrandColors.primary} />
        </View>
      ) : chats.errorMessage ? (
        <View style={styles.centered}>
          <Text style={styles.stateText}>{chats.errorMessage}</Text>
          <AppButton onPress={chats.retry} title="Tentar novamente" />
        </View>
      ) : (
        <FlatList
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons color={BrandColors.textMuted} name="chatbubbles-outline" size={40} />
              <Text style={styles.stateText}>
                Você ainda não tem conversas. Abra o perfil de alguém no fórum para começar uma.
              </Text>
            </View>
          }
          ListFooterComponent={
            chats.isLoadingMore ? (
              <ActivityIndicator color={BrandColors.primary} style={styles.footer} />
            ) : null
          }
          contentContainerStyle={styles.list}
          data={chats.items}
          keyExtractor={(chat) => chat.id}
          onEndReached={chats.loadMore}
          renderItem={({ item }) => <ChatRow chat={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
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
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.divider,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  stateText: {
    color: BrandColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 74,
    backgroundColor: BrandColors.divider,
  },
  footer: {
    paddingVertical: 16,
  },
});
