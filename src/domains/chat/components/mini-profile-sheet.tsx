import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/domains/auth';
import { AppButton, UserAvatar } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { getMockMiniProfile } from '../mocks/chat.mock';
import type { ChatContact } from '../models/chat.types';

interface MiniProfileSheetProps {
  /** Person to show; the sheet is hidden while null. */
  participant: ChatContact | null;
  onClose: () => void;
}

/**
 * Bottom sheet with a short profile of another user and a button to start a
 * conversation. Profile details are mocked for now (see chat.mock.ts).
 */
export function MiniProfileSheet({ participant, onClose }: MiniProfileSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const { user } = useAuth();
  const profile = participant ? getMockMiniProfile(participant) : null;
  const isMe = Boolean(profile && user && profile.id === user.id);

  const startConversation = () => {
    if (!profile) return;
    onClose();
    router.push({
      pathname: '/chat/[userId]',
      params: {
        userId: profile.id,
        name: profile.fullName,
        ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      },
    });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(profile)}>
      <Pressable accessibilityLabel="Fechar perfil" onPress={onClose} style={styles.backdrop} />
      {profile ? (
        <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) + 8 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <UserAvatar avatarUrl={profile.avatarUrl} name={profile.fullName} size={72} />
            <Text numberOfLines={1} style={styles.name}>
              {profile.fullName || 'Usuário'}
            </Text>
            <View style={styles.cityBadge}>
              <Ionicons color={BrandColors.primary} name="location" size={12} />
              <Text style={styles.cityText}>{profile.city}</Text>
            </View>
          </View>

          <Text style={styles.bio}>{profile.bio}</Text>

          <View style={styles.stats}>
            <Stat label="tópicos" value={profile.topicsCount} />
            <View style={styles.divider} />
            <Stat label="respostas" value={profile.repliesCount} />
            <View style={styles.divider} />
            <Stat label="membro desde" value={profile.memberSince} />
          </View>

          {isMe ? (
            <Text style={styles.meNote}>Este é o seu perfil.</Text>
          ) : (
            <AppButton onPress={startConversation} title="Conversar" />
          )}
        </View>
      ) : null}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingTop: 10,
    paddingHorizontal: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: BrandColors.white,
  },
  handle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginBottom: 18,
    borderRadius: 2,
    backgroundColor: BrandColors.divider,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: BrandColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FCE4EF',
  },
  cityText: {
    color: BrandColors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  bio: {
    marginTop: 16,
    color: BrandColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FEF9FA',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statValue: {
    color: BrandColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 2,
    color: BrandColors.textMuted,
    fontSize: 11,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: BrandColors.divider,
  },
  meNote: {
    paddingVertical: 14,
    color: BrandColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
