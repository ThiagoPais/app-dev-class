import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/shared/constants/colors';

interface PaginationFooterProps {
  isLoading: boolean;
  hasMore: boolean;
  errorMessage: string | null;
  onLoadMore: () => Promise<void>;
}

export function PaginationFooter({ isLoading, hasMore, errorMessage, onLoadMore }: PaginationFooterProps) {
  if (!hasMore && !errorMessage && !isLoading) return null;

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="Carregando mais" color={BrandColors.primary} />
      ) : (
        <>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void onLoadMore()} style={styles.button}>
            <Text style={styles.label}>{errorMessage ? 'Tentar novamente' : 'Carregar mais'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', gap: 8 },
  button: { paddingHorizontal: 20, paddingVertical: 12 },
  label: { color: BrandColors.primary, fontWeight: '600' },
  error: { color: BrandColors.textSecondary, textAlign: 'center' },
});
