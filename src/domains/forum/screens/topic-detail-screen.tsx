import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniProfileSheet, type ChatContact } from '@/domains/chat';
import { BrandColors } from '@/shared/constants/colors';
import { confirmAction, showAlert } from '@/shared/utils/dialogs';

import { AuthorAvatar } from '../components/author-avatar';
import { ForumHeader, goBackToForum, HeaderIconButton } from '../components/forum-header';
import { MessageItem } from '../components/message-item';
import { PaginationFooter } from '../components/pagination-footer';
import { ReplyComposer } from '../components/reply-composer';
import { VoteControl } from '../components/vote-control';
import { useTopicDetail } from '../hooks/use-topic-detail';
import type { VoteType } from '../models/forumTypes';
import { formatRelativeTime, wasEdited } from '../utils/format';

const VOTE_ERROR = 'Não foi possível registrar seu voto. Tente novamente.';

export function TopicDetailScreen({ topicId }: { topicId: string }) {
  const { bottom } = useSafeAreaInsets();
  const detail = useTopicDetail(topicId);
  const { topic, messages, userId } = detail;
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<ChatContact | null>(null);

  const isAuthor = Boolean(topic && userId && topic.authorId === userId);
  const editingMessage = messages.find((message) => message.id === editingMessageId) ?? null;

  const handleTopicVote = (voteType: VoteType) => {
    detail.voteTopic(voteType).catch((error) => {
      console.warn('[forum] Failed to vote on topic:', error);
      showAlert('Ops!', VOTE_ERROR);
    });
  };

  const handleMessageVote = (messageId: string, voteType: VoteType) => {
    detail.voteMessage(messageId, voteType).catch((error) => {
      console.warn('[forum] Failed to vote on reply:', error);
      showAlert('Ops!', VOTE_ERROR);
    });
  };

  const handleSubmitReply = async (content: string): Promise<boolean> => {
    try {
      if (editingMessageId) {
        await detail.editMessage(editingMessageId, content);
        setEditingMessageId(null);
      } else {
        await detail.sendMessage(content);
      }
      return true;
    } catch (error) {
      console.warn('[forum] Failed to save reply:', error);
      showAlert(
        'Ops!',
        topic?.isLocked
          ? 'Este tópico está trancado e não aceita novas respostas.'
          : 'Não foi possível enviar sua resposta. Tente novamente.'
      );
      return false;
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const confirmed = await confirmAction({
      title: 'Apagar resposta?',
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Apagar',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await detail.deleteMessage(messageId);
      if (editingMessageId === messageId) setEditingMessageId(null);
    } catch {
      showAlert('Ops!', 'Não foi possível apagar a resposta. Tente novamente.');
    }
  };

  const handleDeleteTopic = async () => {
    const confirmed = await confirmAction({
      title: 'Apagar tópico?',
      message: 'O tópico e suas respostas deixarão de aparecer no fórum.',
      confirmLabel: 'Apagar',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await detail.deleteTopic();
      goBackToForum();
    } catch {
      showAlert('Ops!', 'Não foi possível apagar o tópico. Tente novamente.');
    }
  };

  const headerActions = isAuthor ? (
    <>
      <HeaderIconButton
        icon="create-outline"
        label="Editar tópico"
        onPress={() =>
          router.push({ pathname: '/forum/[topicId]/edit', params: { topicId } })
        }
      />
      <HeaderIconButton
        icon="trash-outline"
        label="Apagar tópico"
        onPress={handleDeleteTopic}
        tone="danger"
      />
    </>
  ) : null;

  if (detail.isLoading || !topic) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
        <ForumHeader title="Tópico" />
        <View style={styles.centered}>
          {detail.isLoading ? (
            <ActivityIndicator color={BrandColors.primary} />
          ) : (
            <>
              <Ionicons color={BrandColors.textMuted} name="alert-circle-outline" size={36} />
              <PaginationFooter isLoading={false} hasMore={false}
                errorMessage={detail.errorMessage} onLoadMore={detail.retry} />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const topicHeader = (
    <View>
      <View style={styles.topicCard}>
        <Pressable
          accessibilityHint="Abre o perfil de quem criou o tópico"
          accessibilityRole="button"
          onPress={() => setProfileUser({ id: topic.authorId, ...topic.authorSnapshot })}
          style={styles.authorRow}>
          <AuthorAvatar author={topic.authorSnapshot} size={40} />
          <View style={styles.authorMeta}>
            <Text numberOfLines={1} style={styles.authorName}>
              {topic.authorSnapshot.fullName || 'Usuário'}
            </Text>
            <Text style={styles.topicMeta}>
              {formatRelativeTime(topic.createdAt)}
              {wasEdited(topic.createdAt, topic.updatedAt) ? ' · editado' : ''}
            </Text>
          </View>
          <View style={styles.cityBadge}>
            <Text numberOfLines={1} style={styles.cityText}>
              {topic.city}
            </Text>
          </View>
        </Pressable>

        <Text style={styles.topicTitle}>{topic.title}</Text>
        <Text style={styles.topicContent}>{topic.content}</Text>

        <View style={styles.topicFooter}>
          <VoteControl netVotes={topic.netVotes} onVote={handleTopicVote} vote={detail.topicVote} />
          {topic.isLocked ? (
            <View style={styles.locked}>
              <Ionicons color={BrandColors.textSecondary} name="lock-closed" size={14} />
              <Text style={styles.lockedText}>Trancado</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {messages.length === 1 ? '1 resposta' : `${messages.length} respostas`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ForumHeader right={headerActions} title="Tópico" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <FlatList
          contentContainerStyle={styles.listContent}
          data={messages}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(message) => message.id}
          ListEmptyComponent={
            <Text style={styles.noReplies}>Ninguém respondeu ainda. Seja o primeiro!</Text>
          }
          ListHeaderComponent={topicHeader}
          ListFooterComponent={
            <PaginationFooter isLoading={detail.isLoadingMore} hasMore={detail.hasMore}
              errorMessage={detail.errorMessage} onLoadMore={detail.errorMessage ? detail.retry : detail.loadMore} />
          }
          onEndReached={detail.errorMessage ? undefined : detail.loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              colors={[BrandColors.primary]}
              onRefresh={detail.refresh}
              refreshing={detail.isRefreshing}
              tintColor={BrandColors.primary}
            />
          }
          renderItem={({ item }) => (
            <MessageItem
              isBeingEdited={item.id === editingMessageId}
              isOwn={item.authorId === userId}
              message={item}
              onAuthorPress={() => setProfileUser({ id: item.authorId, ...item.authorSnapshot })}
              onDelete={() => handleDeleteMessage(item.id)}
              onEdit={() => setEditingMessageId(item.id)}
              onVote={(voteType) => handleMessageVote(item.id, voteType)}
              vote={detail.messageVotes[item.id] ?? null}
            />
          )}
          style={styles.flex}
        />

        {topic.isLocked && !editingMessage ? (
          <View style={[styles.lockedBar, { paddingBottom: Math.max(bottom, 12) }]}>
            <Ionicons color={BrandColors.textSecondary} name="lock-closed" size={14} />
            <Text style={styles.lockedText}>Este tópico não aceita novas respostas.</Text>
          </View>
        ) : (
          <ReplyComposer
            key={topicId}
            bottomInset={bottom}
            editingMessageId={editingMessage?.id ?? null}
            editingContent={editingMessage?.content ?? null}
            onCancelEdit={() => setEditingMessageId(null)}
            onSubmit={handleSubmitReply}
          />
        )}
      </KeyboardAvoidingView>

      <MiniProfileSheet onClose={() => setProfileUser(null)} participant={profileUser} />
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
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  topicCard: {
    padding: 16,
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: BrandColors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorMeta: {
    flex: 1,
  },
  authorName: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  topicMeta: {
    color: BrandColors.textMuted,
    fontSize: 12,
  },
  cityBadge: {
    maxWidth: 130,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FCE4EF',
  },
  cityText: {
    color: '#C0355F',
    fontSize: 12,
    fontWeight: '600',
  },
  topicTitle: {
    marginTop: 14,
    color: BrandColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  topicContent: {
    marginTop: 8,
    color: '#3F3F46',
    fontSize: 15,
    lineHeight: 22,
  },
  topicFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedText: {
    color: BrandColors.textSecondary,
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    color: BrandColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  noReplies: {
    marginTop: 12,
    color: BrandColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  lockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BrandColors.divider,
    backgroundColor: BrandColors.white,
  },
});
