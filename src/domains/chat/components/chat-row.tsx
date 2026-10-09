import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';
import { showAlert } from '@/shared/utils/dialogs';

import type { ChatSummary } from '../models/chat.types';

function formatChatTime(date: Date): string {
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function openChat(chat: ChatSummary) {
  if (!chat.contact) {
    showAlert('Conversas em grupo', 'Esta opção estará disponível em breve.');
    return;
  }

  router.push({
    pathname: '/chat/[userId]',
    params: {
      userId: chat.contact.id,
      name: chat.contact.fullName,
      ...(chat.contact.avatarUrl ? { avatarUrl: chat.contact.avatarUrl } : {}),
    },
  });
}

/** One chat in the user's chat list; opens the conversation on press. */
export function ChatRow({ chat }: { chat: ChatSummary }) {
  const hasUnread = chat.unreadCount > 0;

  return (
    <Pressable
      accessibilityLabel={hasUnread ? `${chat.title}, ${chat.unreadCount} não lidas` : chat.title}
      accessibilityRole="button"
      onPress={() => openChat(chat)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {chat.contact ? (
        <UserAvatar avatarUrl={chat.avatarUrl} name={chat.title} size={46} />
      ) : (
        <View style={styles.groupAvatar}>
          <Ionicons color={BrandColors.white} name="people" size={22} />
        </View>
      )}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, hasUnread && styles.titleUnread]}>
          {chat.title}
        </Text>
        <Text numberOfLines={1} style={[styles.preview, hasUnread && styles.previewUnread]}>
          {chat.preview}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={[styles.time, hasUnread && styles.timeUnread]}>
          {formatChatTime(chat.lastMessageAt)}
        </Text>
        {hasUnread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.65,
  },
  groupAvatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: BrandColors.secondary,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  titleUnread: {
    fontWeight: '700',
  },
  preview: {
    marginTop: 2,
    color: BrandColors.textSecondary,
    fontSize: 13,
  },
  previewUnread: {
    color: BrandColors.textPrimary,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  time: {
    color: BrandColors.textMuted,
    fontSize: 11,
  },
  timeUnread: {
    color: BrandColors.primary,
    fontWeight: '600',
  },
  badge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: BrandColors.primary,
  },
  badgeText: {
    color: BrandColors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
