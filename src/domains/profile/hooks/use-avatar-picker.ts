import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { useAuth } from '@/domains/auth';

import { uploadProfileAvatar } from '../services/avatar.service';

const GENERIC_UPLOAD_ERROR =
  'Não foi possível atualizar sua foto. Confira sua conexão e tente novamente.';

export function useAvatarPicker() {
  const { firebaseUser, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pickAvatar = useCallback(async () => {
    if (!firebaseUser || isUploading) return;

    setErrorMessage(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        shape: 'oval',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.canceled) return;

      setIsUploading(true);
      await uploadProfileAvatar(firebaseUser.uid, result.assets[0]);
      await refreshUser();
    } catch {
      setErrorMessage(GENERIC_UPLOAD_ERROR);
    } finally {
      setIsUploading(false);
    }
  }, [firebaseUser, isUploading, refreshUser]);

  return { errorMessage, isUploading, pickAvatar };
}
