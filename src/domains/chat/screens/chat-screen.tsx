import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, UserAvatar } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';
import { showAlert } from '@/shared/utils/dialogs';

import { MAX_MESSAGE_LENGTH } from '../constants';
import { useDirectChat } from '../hooks/use-direct-chat';
import type { ChatContact, ConversationMessage } from '../models/chat.types';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(logged)/(tabs)/forum');
}

/** One-to-one conversation screen backed by the chat service. */
export function ChatScreen({ participant }: { participant: ChatContact }) {
  const { bottom } = useSafeAreaInsets();
  const chat = useDirectChat(participant);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ConversationMessage>>(null);
  const scrolledToId = useRef<string | null>(null);
  const canSend = chat.canSend && Boolean(text.trim());

  const handleSend = async () => {
    if (!canSend) return;
    const draft = text;
    setText('');
    try {
      await chat.send(draft);
    } catch (error) {
      console.warn('[chat] Failed to send message:', error);
      setText((current) => current || draft);
      showAlert('Não foi possível enviar a mensagem.', 'Tente novamente.');
    }
  };

  // Only follow new messages; loading older ones must not jump to the bottom.
  const scrollToNewest = () => {
    const newestId = chat.messages.at(-1)?.id ?? null;
    if (!newestId || newestId === scrolledToId.current) return;
    listRef.current?.scrollToEnd({ animated: scrolledToId.current !== null });
    scrolledToId.current = newestId;
  };

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
        <UserAvatar avatarUrl={participant.avatarUrl} name={participant.fullName} size={38} />
        <Text numberOfLines={1} style={styles.headerName}>
          {participant.fullName || 'Usuário'}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        {chat.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={BrandColors.primary} />
          </View>
        ) : chat.errorMessage ? (
          <View style={styles.centered}>
            <Text style={styles.stateText}>{chat.errorMessage}</Text>
            <AppButton onPress={chat.retry} title="Tentar novamente" />
          </View>
        ) : (
          <FlatList
            ListEmptyComponent={
              <Text style={styles.stateText}>
                Envie a primeira mensagem para {participant.fullName || 'este usuário'}.
              </Text>
            }
            ListHeaderComponent={
              chat.hasMore ? (
                <OlderMessagesButton isLoading={chat.isLoadingMore} onPress={chat.loadMore} />
              ) : null
            }
            contentContainerStyle={styles.list}
            data={chat.messages}
            keyExtractor={(message) => message.id}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToNewest}
            ref={listRef}
            renderItem={({ item }) => <Bubble isMine={item.senderId === chat.myId} message={item} />}
            style={styles.flex}
          />
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(bottom, 10) }]}>
          <TextInput
            maxLength={MAX_MESSAGE_LENGTH}
            multiline
            onChangeText={setText}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor={BrandColors.placeholder}
            style={styles.input}
            value={text}
          />
          <Pressable
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
            disabled={!canSend}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.send,
              !canSend && styles.sendDisabled,
              pressed && styles.pressed,
            ]}>
            <Ionicons color={BrandColors.white} name="send" size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OlderMessagesButton({ isLoading, onPress }: { isLoading: boolean; onPress: () => void }) {
  if (isLoading) return <ActivityIndicator color={BrandColors.primary} style={styles.older} />;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.older, pressed && styles.pressed]}>
      <Text style={styles.olderText}>Carregar mensagens anteriores</Text>
    </Pressable>
  );
}

function Bubble({ message, isMine }: { message: ConversationMessage; isMine: boolean }) {
  return (
    <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.text}</Text>
        <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
          {formatTime(message.sentAt)}
        </Text>
      </View>
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
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
  headerName: {
    flex: 1,
    color: BrandColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
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
    gap: 8,
    padding: 16,
  },
  older: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  olderText: {
    color: BrandColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
    backgroundColor: BrandColors.white,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
    backgroundColor: BrandColors.primary,
  },
  bubbleText: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: BrandColors.white,
  },
  bubbleTime: {
    alignSelf: 'flex-end',
    marginTop: 2,
    color: BrandColors.textMuted,
    fontSize: 10,
  },
  bubbleTimeMine: {
    color: '#F3D5E0',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: BrandColors.divider,
    backgroundColor: BrandColors.white,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingTop: 11,
    paddingBottom: 11,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BrandColors.inputBorder,
    borderRadius: 21,
    backgroundColor: BrandColors.inputBackground,
    color: BrandColors.textPrimary,
    fontSize: 15,
  },
  send: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: BrandColors.primary,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
});
