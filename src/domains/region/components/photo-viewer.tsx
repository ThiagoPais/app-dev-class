import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors } from '@/shared/constants/colors';

import type { RegionPhoto } from '../models/region.types';

interface PhotoViewerProps {
  photos: RegionPhoto[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/** Full-screen, swipeable photo viewer. */
export function PhotoViewer({ photos, initialIndex, visible, onClose }: PhotoViewerProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [lastOpenIndex, setLastOpenIndex] = useState(initialIndex);

  // Reset the counter whenever the viewer is opened on a different photo.
  if (visible && initialIndex !== lastOpenIndex) {
    setLastOpenIndex(initialIndex);
    setIndex(initialIndex);
  }

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const current = photos[index];

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.toolbar}>
          <Text style={styles.counter}>
            {index + 1} / {photos.length}
          </Text>
          <Pressable
            accessibilityLabel="Fechar fotos"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}>
            <Ionicons color={BrandColors.white} name="close" size={28} />
          </Pressable>
        </View>
        <FlatList
          data={photos}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          horizontal
          initialScrollIndex={initialIndex}
          key={`${width}-${initialIndex}`}
          keyExtractor={(photo) => photo.uri}
          onMomentumScrollEnd={onScrollEnd}
          pagingEnabled
          renderItem={({ item }) => (
            <View style={{ width }}>
              <Image contentFit="contain" source={{ uri: item.uri }} style={styles.photo} />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
        {current?.caption || current?.credit ? (
          <Text style={styles.caption}>
            {[current.caption, current.credit].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  counter: {
    color: BrandColors.white,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  photo: {
    flex: 1,
  },
  caption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#D4D4D4',
    fontSize: 13,
    textAlign: 'center',
  },
});
