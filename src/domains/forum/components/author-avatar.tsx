import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

import type { AuthorSnapshot } from '../models/forumTypes';
import { getInitials } from '../utils/format';

export function AuthorAvatar({ author, size = 36 }: { author: AuthorSnapshot; size?: number }) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.avatar, dimensions]}>
      {author.avatarUrl ? (
        <Image contentFit="cover" source={{ uri: author.avatarUrl }} style={StyleSheet.absoluteFill} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
          {getInitials(author.fullName) || '?'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: BrandColors.secondary,
  },
  initials: {
    color: BrandColors.white,
    fontWeight: '700',
  },
});
