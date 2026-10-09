import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface UserAvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: number;
}

/** Round user photo, falling back to the name's initials. */
export function UserAvatar({ name, avatarUrl, size = 36 }: UserAvatarProps) {
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.avatar, dimensions]}>
      {avatarUrl ? (
        <Image contentFit="cover" source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{getInitials(name) || '?'}</Text>
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
