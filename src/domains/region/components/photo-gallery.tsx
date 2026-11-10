import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import type { RegionPhoto } from '../models/region.types';
import { PhotoViewer } from './photo-viewer';

const PREVIEW_COUNT = 3;

/** One large photo and two small ones; the last small one shows how many are left. */
export function PhotoGallery({ photos }: { photos: RegionPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!photos.length) return null;

  const [main, ...side] = photos.slice(0, PREVIEW_COUNT);
  const hiddenCount = photos.length - PREVIEW_COUNT;

  return (
    <View style={styles.gallery}>
      <Thumbnail onPress={() => setOpenIndex(0)} photo={main} style={styles.main} />
      {side.length ? (
        <View style={styles.side}>
          {side.map((photo, index) => {
            const photoIndex = index + 1;
            const isLast = photoIndex === PREVIEW_COUNT - 1;
            return (
              <Thumbnail
                key={photo.uri}
                onPress={() => setOpenIndex(photoIndex)}
                overlay={isLast && hiddenCount > 0 ? `+${hiddenCount} fotos` : undefined}
                photo={photo}
                style={styles.sideItem}
              />
            );
          })}
        </View>
      ) : null}
      <PhotoViewer
        initialIndex={openIndex ?? 0}
        onClose={() => setOpenIndex(null)}
        photos={photos}
        visible={openIndex !== null}
      />
    </View>
  );
}

function Thumbnail({
  photo,
  overlay,
  onPress,
  style,
}: {
  photo: RegionPhoto;
  overlay?: string;
  onPress: () => void;
  style: object;
}) {
  return (
    <Pressable
      accessibilityLabel={overlay ? `Ver todas as fotos (${overlay})` : photo.caption ?? 'Foto da região'}
      accessibilityRole="imagebutton"
      onPress={onPress}
      style={({ pressed }) => [styles.thumbnail, style, pressed && styles.pressed]}>
      <Image
        contentFit="cover"
        source={{ uri: photo.uri }}
        style={StyleSheet.absoluteFill}
        transition={200}
      />
      {overlay ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{overlay}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gallery: {
    height: 220,
    flexDirection: 'row',
    gap: 8,
  },
  main: {
    flex: 2,
  },
  side: {
    flex: 1,
    gap: 8,
  },
  sideItem: {
    flex: 1,
  },
  thumbnail: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#E5E5E5',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  overlayText: {
    color: BrandColors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
