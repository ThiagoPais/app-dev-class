import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/domains/auth';
import { BrandColors } from '@/shared/constants/colors';

import { useAvatarPicker } from '../hooks/use-avatar-picker';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface MenuItem {
  icon: IoniconName;
  label: string;
  tone?: 'default' | 'danger';
}

const preferenceItems: MenuItem[] = [
  { icon: 'notifications-outline', label: 'Notificações' },
  { icon: 'search-outline', label: 'Preferências de busca' },
];

const accountItems: MenuItem[] = [
  { icon: 'settings-outline', label: 'Configurações' },
  { icon: 'lock-closed-outline', label: 'Privacidade' },
  { icon: 'help-circle-outline', label: 'Ajuda e suporte' },
  { icon: 'log-out-outline', label: 'Sair', tone: 'danger' },
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function MenuSection({
  items,
  label,
  onLogout,
}: {
  items: MenuItem[];
  label: string;
  onLogout?: () => void;
}) {
  const handlePress = useCallback(
    (item: MenuItem) => {
      if (item.tone === 'danger') {
        onLogout?.();
        return;
      }

      Alert.alert(item.label, 'Esta opção estará disponível em breve.');
    },
    [onLogout]
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.menuCard}>
        {items.map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={item.label}
            onPress={() => handlePress(item)}
            style={({ pressed }) => [
              styles.menuRow,
              index < items.length - 1 && styles.menuRowBorder,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.menuIcon, item.tone === 'danger' && styles.dangerIcon]}>
              <Ionicons
                color={item.tone === 'danger' ? '#E53935' : '#767676'}
                name={item.icon}
                size={17}
              />
            </View>
            <Text style={[styles.menuLabel, item.tone === 'danger' && styles.dangerText]}>
              {item.label}
            </Text>
            <Ionicons color="#C8C8C8" name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { top } = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const { errorMessage, isUploading, pickAvatar } = useAvatarPicker();

  const fullName = user?.fullName ?? 'Usuário';
  const handle = user?.email ? `@${user.email.split('@')[0]}` : '';

  const handleLogout = useCallback(() => {
    logout().catch(() => {
      Alert.alert('Não foi possível sair', 'Tente novamente em alguns instantes.');
    });
  }, [logout]);

  return (
    <View style={styles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: Math.max(top + 18, 48) }]}>
          <View style={styles.avatarButton}>
            <View style={styles.avatar}>
              {user?.avatarUrl ? (
                <Image
                  cachePolicy="none"
                  contentFit="cover"
                  source={{ uri: user.avatarUrl }}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <Text style={styles.initials}>{getInitials(fullName)}</Text>
              )}
              {isUploading ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color={BrandColors.white} />
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityHint="Abre a galeria para escolher uma nova foto"
              accessibilityLabel="Alterar foto de perfil"
              accessibilityRole="button"
              disabled={isUploading}
              hitSlop={6}
              onPress={pickAvatar}
              style={({ pressed }) => [styles.cameraBadge, pressed && styles.cameraPressed]}>
              <Ionicons color={BrandColors.white} name="camera" size={14} />
            </Pressable>
          </View>

          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.handle}>{handle}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('Editar perfil', 'A edição dos demais dados estará disponível em breve.')
            }
            style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}>
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </Pressable>
          {errorMessage ? <Text style={styles.uploadError}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.body}>
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('Meus favoritos', 'Sua lista de regiões salvas aparecerá aqui.')}
            style={({ pressed }) => [styles.favoritesCard, pressed && styles.favoritesPressed]}>
            <View style={styles.favoriteIcon}>
              <Ionicons color={BrandColors.white} name="heart" size={20} />
            </View>
            <View style={styles.favoriteCopy}>
              <Text style={styles.favoriteTitle}>Meus favoritos</Text>
              <Text style={styles.favoriteSubtitle}>Regiões que você salvou</Text>
            </View>
            <View style={styles.countPill}>
              <Text style={styles.countText}>2</Text>
              <Ionicons color="#666666" name="chevron-forward" size={12} />
            </View>
          </Pressable>

          <MenuSection items={preferenceItems} label="Preferências" />
          <MenuSection items={accountItems} label="Conta" onLogout={handleLogout} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#FEF9FA',
  },
  content: {
    paddingBottom: 104,
  },
  hero: {
    minHeight: 246,
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: BrandColors.secondary,
    borderBottomLeftRadius: 74,
    borderBottomRightRadius: 28,
  },
  avatarButton: {
    width: 80,
    height: 80,
  },
  avatar: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 40,
    backgroundColor: '#78951A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.17,
    shadowRadius: 4,
    elevation: 5,
  },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BrandColors.white,
    borderRadius: 14,
    backgroundColor: BrandColors.primary,
  },
  cameraPressed: {
    opacity: 0.88,
  },
  initials: {
    color: BrandColors.white,
    fontSize: 26,
    fontWeight: '700',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  name: {
    marginTop: 17,
    color: BrandColors.white,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  handle: {
    marginTop: 1,
    color: '#FFF0F5',
    fontSize: 12,
    lineHeight: 16,
  },
  editButton: {
    width: 108,
    height: 25,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: BrandColors.primary,
  },
  editButtonPressed: {
    opacity: 0.78,
  },
  editButtonText: {
    color: BrandColors.white,
    fontSize: 11,
    fontWeight: '500',
  },
  uploadError: {
    position: 'absolute',
    bottom: 3,
    paddingHorizontal: 24,
    color: BrandColors.white,
    fontSize: 10,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 22,
  },
  favoritesCard: {
    height: 58,
    marginTop: 14,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderRadius: 30,
    backgroundColor: BrandColors.primary,
    shadowColor: '#7D294B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  favoritesPressed: {
    opacity: 0.88,
  },
  favoriteIcon: {
    width: 34,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#AD5377',
  },
  favoriteCopy: {
    flex: 1,
    marginLeft: 13,
  },
  favoriteTitle: {
    color: BrandColors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  favoriteSubtitle: {
    marginTop: 2,
    color: '#DAB6C5',
    fontSize: 9,
  },
  countPill: {
    minWidth: 34,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  countText: {
    color: '#555555',
    fontSize: 10,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    marginBottom: 8,
    marginLeft: 5,
    color: '#696969',
    fontSize: 10,
  },
  menuCard: {
    paddingHorizontal: 13,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    backgroundColor: BrandColors.white,
    shadowColor: '#6A3448',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
  },
  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
  },
  pressed: {
    opacity: 0.65,
  },
  menuIcon: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 7,
    backgroundColor: '#E0E0E0',
  },
  dangerIcon: {
    backgroundColor: '#FFE2E2',
  },
  menuLabel: {
    flex: 1,
    color: '#333333',
    fontSize: 12,
  },
  dangerText: {
    color: '#D91D1D',
  },
});
