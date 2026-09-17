import type { ImagePickerAsset } from 'expo-image-picker';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/services/firebase';

export async function uploadProfileAvatar(
  userId: string,
  asset: ImagePickerAsset
): Promise<string> {
  const contentType = asset.mimeType ?? 'image/jpeg';
  const uploadData = asset.file ?? (await (await fetch(asset.uri)).blob());
  const avatarRef = ref(storage, `users/${userId}/profile-picture`);

  await uploadBytes(avatarRef, uploadData, { contentType });
  const avatarUrl = await getDownloadURL(avatarRef);

  await setDoc(
    doc(db, 'users', userId),
    {
      avatarUrl,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return avatarUrl;
}
