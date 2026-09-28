import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppTextInput } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { CityChips } from '../components/city-chips';
import { ForumHeader } from '../components/forum-header';
import { CONTENT_MAX_LENGTH, TITLE_MAX_LENGTH, useTopicForm } from '../hooks/use-topic-form';

export function TopicFormScreen({ topicId }: { topicId?: string }) {
  const { bottom } = useSafeAreaInsets();
  const { values, errors, isEditing, isLoading, isSubmitting, handleChange, submit } =
    useTopicForm(topicId);
  const [isContentFocused, setIsContentFocused] = useState(false);

  const handleSubmit = async () => {
    const savedId = await submit();
    if (!savedId) return;

    if (isEditing) {
      router.back();
    } else {
      // Replace the form so "back" from the new topic returns to the feed
      router.replace({ pathname: '/forum/[topicId]', params: { topicId: savedId } });
    }
  };

  const title = isEditing ? 'Editar tópico' : 'Novo tópico';
  const cannotEdit = isEditing && Boolean(errors.general) && !values.title;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ForumHeader title={title} />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BrandColors.primary} />
        </View>
      ) : cannotEdit ? (
        <View style={styles.centered}>
          <Text style={styles.generalError}>{errors.general}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottom, 16) + 16 }]}
            keyboardShouldPersistTaps="handled">
            {!isEditing ? (
              <View style={styles.field}>
                <Text style={styles.label}>Sobre qual RA?</Text>
                <CityChips onSelect={(city) => handleChange('city', city)} selected={values.city} />
                {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
              </View>
            ) : (
              <Text style={styles.cityInfo}>RA: {values.city}</Text>
            )}

            <AppTextInput
              error={errors.title}
              label="Título"
              maxLength={TITLE_MAX_LENGTH}
              onChangeText={(text) => handleChange('title', text)}
              placeholder="Ex.: Obras na Ceilândia"
              value={values.title}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Conteúdo</Text>
              <TextInput
                maxLength={CONTENT_MAX_LENGTH}
                multiline
                onBlur={() => setIsContentFocused(false)}
                onChangeText={(text) => handleChange('content', text)}
                onFocus={() => setIsContentFocused(true)}
                placeholder="Conte o que está acontecendo, faça uma pergunta ou compartilhe uma dica..."
                placeholderTextColor={BrandColors.placeholder}
                style={[
                  styles.textArea,
                  isContentFocused && styles.textAreaFocused,
                  Boolean(errors.content) && styles.textAreaError,
                ]}
                textAlignVertical="top"
                value={values.content}
              />
              <View style={styles.contentFooter}>
                <Text style={styles.error}>{errors.content ?? ''}</Text>
                <Text style={styles.counter}>
                  {values.content.length}/{CONTENT_MAX_LENGTH}
                </Text>
              </View>
            </View>

            {errors.general ? <Text style={styles.generalError}>{errors.general}</Text> : null}

            <AppButton
              loading={isSubmitting}
              onPress={handleSubmit}
              title={isEditing ? 'Salvar alterações' : 'Publicar tópico'}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: BrandColors.background,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    color: BrandColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  cityInfo: {
    marginBottom: 16,
    color: BrandColors.textSecondary,
    fontSize: 14,
  },
  textArea: {
    minHeight: 160,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: BrandColors.inputBorder,
    borderRadius: 20,
    backgroundColor: BrandColors.inputBackground,
    color: BrandColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  textAreaFocused: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.white,
  },
  textAreaError: {
    borderColor: '#DC2626',
  },
  contentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 14,
  },
  counter: {
    color: BrandColors.textMuted,
    fontSize: 12,
  },
  error: {
    flex: 1,
    marginTop: 4,
    color: '#DC2626',
    fontSize: 12,
  },
  generalError: {
    marginBottom: 12,
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
});
