import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import type { ForumMessage, VoteType } from '../models/forumTypes';
import { formatRelativeTime, wasEdited } from '../utils/format';
import { AuthorAvatar } from './author-avatar';
import { VoteControl } from './vote-control';

interface MessageItemProps {
  message: ForumMessage;
  vote: VoteType | null;
  isOwn: boolean;
  isBeingEdited: boolean;
  onVote: (voteType: VoteType) => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Tapping the author opens their mini profile. */
  onAuthorPress?: () => void;
}

export function MessageItem({
  message,
  vote,
  isOwn,
  isBeingEdited,
  onVote,
  onEdit,
  onDelete,
  onAuthorPress,
}: MessageItemProps) {
  const edited = wasEdited(message.createdAt, message.updatedAt);

  return (
    <View style={[styles.card, isBeingEdited && styles.cardEditing]}>
      <Pressable
        accessibilityHint="Abre o perfil de quem respondeu"
        accessibilityRole="button"
        disabled={!onAuthorPress}
        onPress={onAuthorPress}
        style={styles.header}>
        <AuthorAvatar author={message.authorSnapshot} size={30} />
        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.author}>
            {message.authorSnapshot.fullName || 'Usuário'}
            {isOwn ? <Text style={styles.you}> · você</Text> : null}
          </Text>
          <Text style={styles.time}>
            {formatRelativeTime(message.createdAt)}
            {edited ? ' · editado' : ''}
          </Text>
        </View>
      </Pressable>

      <Text style={styles.content}>{message.content}</Text>

      <View style={styles.footer}>
        <VoteControl netVotes={message.netVotes} onVote={onVote} size="small" vote={vote} />
        {isOwn ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Editar resposta"
              accessibilityRole="button"
              hitSlop={6}
              onPress={onEdit}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Ionicons color={BrandColors.textSecondary} name="create-outline" size={16} />
              <Text style={styles.actionText}>Editar</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Apagar resposta"
              accessibilityRole="button"
              hitSlop={6}
              onPress={onDelete}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Ionicons color="#E53935" name="trash-outline" size={16} />
              <Text style={[styles.actionText, styles.danger]}>Apagar</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    backgroundColor: BrandColors.white,
  },
  cardEditing: {
    borderColor: BrandColors.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  meta: {
    flex: 1,
  },
  author: {
    color: BrandColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  you: {
    color: BrandColors.secondary,
    fontWeight: '500',
  },
  time: {
    color: BrandColors.textMuted,
    fontSize: 12,
  },
  content: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: BrandColors.textSecondary,
    fontSize: 13,
  },
  danger: {
    color: '#E53935',
  },
  pressed: {
    opacity: 0.6,
  },
});
