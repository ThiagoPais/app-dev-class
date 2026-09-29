import { useEffect, useState } from 'react';

import { useAuth } from '@/domains/auth';

import { FORUM_REGION } from '../constants/regions';
import { createForumTopic, getForumTopic, updateForumTopic } from '../services/forum.service';

export const TITLE_MAX_LENGTH = 120;
export const CONTENT_MAX_LENGTH = 2000;

export interface TopicFormValues {
  title: string;
  content: string;
  city: string | null;
}

export interface TopicFormErrors {
  title?: string;
  content?: string;
  city?: string;
  general?: string;
}

/**
 * Form state for creating a topic, or editing one when `topicId` is given.
 * Only the title and content can be edited; the RA is fixed after creation.
 */
export function useTopicForm(topicId?: string) {
  const { user } = useAuth();
  const isEditing = Boolean(topicId);

  const [values, setValues] = useState<TopicFormValues>({ title: '', content: '', city: null });
  const [errors, setErrors] = useState<TopicFormErrors>({});
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!topicId) return;

    let cancelled = false;
    getForumTopic(topicId)
      .then((topic) => {
        if (cancelled) return;
        if (!topic || topic.isDeleted || topic.authorId !== user?.id) {
          setErrors({ general: 'Você não pode editar este tópico.' });
          return;
        }
        setValues({ title: topic.title, content: topic.content, city: topic.city });
      })
      .catch(() => {
        if (!cancelled) setErrors({ general: 'Não foi possível carregar o tópico.' });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [topicId, user?.id]);

  const handleChange = <K extends keyof TopicFormValues>(field: K, value: TopicFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: TopicFormErrors = {};
    const title = values.title.trim();
    const content = values.content.trim();

    if (title.length < 5) {
      newErrors.title = 'O título deve ter pelo menos 5 caracteres.';
    }
    if (content.length < 10) {
      newErrors.content = 'Escreva pelo menos 10 caracteres.';
    }
    if (!isEditing && !values.city) {
      newErrors.city = 'Escolha a RA sobre a qual você quer conversar.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Saves the topic and returns its id, or null when validation or saving fails. */
  const submit = async (): Promise<string | null> => {
    if (!user || !validate()) return null;

    setIsSubmitting(true);
    try {
      if (topicId) {
        await updateForumTopic(topicId, { title: values.title, content: values.content });
        return topicId;
      }

      const topic = await createForumTopic({
        authorId: user.id,
        authorSnapshot: { fullName: user.fullName, avatarUrl: user.avatarUrl ?? null },
        title: values.title,
        content: values.content,
        region: FORUM_REGION,
        city: values.city!,
      });
      return topic.id;
    } catch {
      setErrors({ general: 'Não foi possível salvar o tópico. Tente novamente.' });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { values, errors, isEditing, isLoading, isSubmitting, handleChange, submit };
}
