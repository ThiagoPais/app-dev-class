import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

const MAX_LENGTH = 1000;

interface ReplyComposerProps {
  editingMessageId: string | null;
  /** When set, the composer edits this text instead of writing a new reply. */
  editingContent: string | null;
  onCancelEdit: () => void;
  onSubmit: (content: string) => Promise<boolean>;
  bottomInset: number;
}

export function ReplyComposer(props: ReplyComposerProps) {
  return <ReplyComposerForm key={props.editingMessageId ?? 'new'} {...props} />;
}

function ReplyComposerForm({
  editingContent,
  onCancelEdit,
  onSubmit,
  bottomInset,
}: ReplyComposerProps) {
  const [text, setText] = useState(editingContent ?? '');
  const [isSending, setIsSending] = useState(false);
  const isEditing = editingContent !== null;

  const canSend = text.trim().length > 0 && !isSending;

  const handleSubmit = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      const ok = await onSubmit(text.trim());
      if (ok) setText('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottomInset, 10) }]}>
      {isEditing ? (
        <View style={styles.editBanner}>
          <Ionicons color={BrandColors.primary} name="create-outline" size={14} />
          <Text style={styles.editText}>Editando sua resposta</Text>
          <Pressable accessibilityRole="button" disabled={isSending} hitSlop={8} onPress={onCancelEdit}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.row}>
        <TextInput
          editable={!isSending}
          maxLength={MAX_LENGTH}
          multiline
          onChangeText={setText}
          placeholder="Escreva uma resposta..."
          placeholderTextColor={BrandColors.placeholder}
          style={styles.input}
          value={text}
        />
        <Pressable
          accessibilityLabel={isEditing ? 'Salvar edição' : 'Enviar resposta'}
          accessibilityRole="button"
          disabled={!canSend}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.send,
            !canSend && styles.sendDisabled,
            pressed && styles.pressed,
          ]}>
          {isSending ? (
            <ActivityIndicator color={BrandColors.white} size="small" />
          ) : (
            <Ionicons
              color={BrandColors.white}
              name={isEditing ? 'checkmark' : 'send'}
              size={18}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: BrandColors.divider,
    backgroundColor: BrandColors.white,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  editText: {
    flex: 1,
    color: BrandColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  cancel: {
    color: BrandColors.textSecondary,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
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
