import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors } from '@/shared/constants/colors';

import { useNotifications } from '../hooks/use-notifications';
import type { AppNotification, NotificationKind } from '../mocks/notifications.mock';

type Filter = 'all' | NotificationKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'chat', label: 'Conversas' },
  { key: 'forum', label: 'Fórum' },
];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(logged)/(tabs)/profile');
}

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
}) {
  const isChat = item.kind === 'chat';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, isChat ? styles.iconChat : styles.iconForum]}>
        <Ionicons
          color={BrandColors.white}
          name={isChat ? 'chatbubble-ellipses' : 'heart'}
          size={18}
        />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {item.title}
          </Text>
          <Text style={styles.rowTime}>{item.time}</Text>
        </View>
        <Text numberOfLines={1} style={styles.rowActor}>
          {item.actorName}
          {item.context ? <Text style={styles.rowContext}> · {item.context}</Text> : null}
        </Text>
        <Text numberOfLines={2} style={styles.rowMessage}>
          {item.message}
        </Text>
      </View>
      {!item.read ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

/** Mocked notifications list (chat messages and favorite forum activity). */
export function NotificationsScreen() {
  const { notifications, unreadCount, markAsRead, markAllAsRead: markAllRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? notifications : notifications.filter((n) => n.kind === filter)),
    [filter, notifications]
  );

  const handlePress = useCallback(
    (item: AppNotification) => {
      markAsRead(item.id);
      router.push(item.kind === 'chat' ? '/chat' : '/(logged)/(tabs)/forum');
    },
    [markAsRead]
  );

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
        <Text style={styles.headerTitle}>Notificações</Text>
        {unreadCount > 0 ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={markAllRead}>
            <Text style={styles.markAll}>Marcar todas como lidas</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons color={BrandColors.textMuted} name="notifications-off-outline" size={36} />
            <Text style={styles.emptyText}>Nenhuma notificação por aqui.</Text>
          </View>
        }
        renderItem={({ item }) => <NotificationRow item={item} onPress={handlePress} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.divider,
    backgroundColor: BrandColors.white,
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
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  markAll: {
    color: BrandColors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: BrandColors.inputBorder,
    borderRadius: 16,
    backgroundColor: BrandColors.white,
  },
  chipActive: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.primary,
  },
  chipText: {
    color: BrandColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: BrandColors.white,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  separator: {
    height: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    backgroundColor: BrandColors.white,
    shadowColor: '#6A3448',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  rowUnread: {
    borderColor: '#F3C6D6',
    backgroundColor: '#FFF4F8',
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  iconChat: {
    backgroundColor: BrandColors.secondary,
  },
  iconForum: {
    backgroundColor: BrandColors.primary,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  rowTime: {
    color: BrandColors.textMuted,
    fontSize: 10,
  },
  rowActor: {
    color: '#444444',
    fontSize: 12,
    fontWeight: '600',
  },
  rowContext: {
    color: BrandColors.textSecondary,
    fontWeight: '400',
  },
  rowMessage: {
    color: BrandColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    marginTop: 4,
    borderRadius: 4,
    backgroundColor: BrandColors.secondary,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 60,
  },
  emptyText: {
    color: BrandColors.textSecondary,
    fontSize: 13,
  },
});
