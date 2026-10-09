import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
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

import { useAuth } from '@/domains/auth';
import { UserAvatar } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { useMockChat } from '../hooks/use-mock-chat';
import type { ConversationMessage, ChatContact } from '../models/chat.types';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(logged)/(tabs)/forum');
}

/**
 * One-to-one conversation screen. Mocked for now: messages live in memory
 * (useMockChat) until the WebSocket backend is ready.
 */
export function ChatScreen({ participant }: { participant: ChatContact }) {
  const { bottom } = useSafeAreaInsets();
  const { user } = useAuth();
  const myId = user?.id ?? 'me';
  const { messages, isOtherTyping, send } = useMockChat(participant.id, myId);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ConversationMessage>>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    send(text);
    setText('');
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
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.headerName}>
            {participant.fullName || 'Usuário'}
          </Text>
          <Text style={styles.headerStatus}>{isOtherTyping ? 'digitando...' : 'online'}</Text>
        </View>
      </View>

      <View style={styles.mockBanner}>
        <Ionicons color={BrandColors.textSecondary} name="construct-outline" size={13} />
        <Text style={styles.mockText}>Prévia: as mensagens ainda não são enviadas de verdade.</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <FlatList
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ref={listRef}
          renderItem={({ item }) => <Bubble isMine={item.senderId === myId} message={item} />}
          style={styles.flex}
        />

        <View style={[styles.composer, { paddingBottom: Math.max(bottom, 10) }]}>
          <TextInput
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
            disabled={!text.trim()}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.send,
              !text.trim() && styles.sendDisabled,
              pressed && styles.pressed,
            ]}>
            <Ionicons color={BrandColors.white} name="send" size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  headerText: {
    flex: 1,
  },
  headerName: {
    color: BrandColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerStatus: {
    color: '#2E9E5B',
    fontSize: 12,
  },
  mockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#F5F0F2',
  },
  mockText: {
    color: BrandColors.textSecondary,
    fontSize: 11,
  },
  list: {
    gap: 8,
    padding: 16,
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
