import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { HeaderBanner } from '@/shared/components/header-banner';
import { MapeeiLogo } from '@/shared/components/logo';
import { AppButton, AppCheckbox, AppTextInput } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { AuthFooterLink } from '../components';
import { useAuth } from '../hooks/use-auth';
import { useCompleteProfileForm } from '../hooks';
import type { GoogleAccount } from '../models/auth.types';
import { getGoogleAccount } from '../services/auth.service';

/**
 * Shown after a first Google sign-in: the account has no Firestore profile yet,
 * so the user confirms their name and provides the CPF to finish signing up.
 */
export function CompleteProfileScreen() {
  const { firebaseUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </View>
    );
  }

  if (!firebaseUser) {
    return <Redirect href="/login" />;
  }

  return <CompleteProfileForm account={getGoogleAccount(firebaseUser)} />;
}

function CompleteProfileForm({ account }: { account: GoogleAccount }) {
  const { completeGoogleSignup, logout } = useAuth();

  const { values, errors, isSubmitting, handleChange, handleSubmit } = useCompleteProfileForm({
    initialName: account.fullName,
    onSubmit: async (data) => {
      await completeGoogleSignup(data);
      router.replace('/(logged)/(tabs)/landingPage');
    },
  });

  const handleUseAnotherAccount = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <HeaderBanner />

          <View style={styles.content}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Falta pouco!</Text>
              <Text style={styles.subtitle}>
                Confirme seus dados para concluir o cadastro.
              </Text>
            </View>

            {/* Google Account */}
            <View style={styles.accountCard}>
              {account.avatarUrl ? (
                <Image
                  source={{ uri: account.avatarUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel="Foto da conta Google"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={28} color={BrandColors.textMuted} />
                </View>
              )}
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Conectado com Google</Text>
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {account.email}
                </Text>
              </View>
            </View>

            <View style={styles.formContainer}>
              <AppTextInput
                label="Nome"
                placeholder="Digite seu nome"
                value={values.name}
                error={errors.name}
                onChangeText={(text) => handleChange('name', text)}
              />

              <AppTextInput
                label="CPF"
                placeholder="000.000.000-00"
                keyboardType="numeric"
                value={values.cpf}
                error={errors.cpf}
                onChangeText={(text) => handleChange('cpf', text)}
                maxLength={14}
              />

              <AppCheckbox
                label="Li e concordo com os termos de uso"
                checked={values.agreeToTerms}
                onValueChange={(checked) => handleChange('agreeToTerms', checked)}
                containerStyle={styles.checkboxContainer}
              />
              {errors.agreeToTerms ? (
                <Text style={styles.termsError}>{errors.agreeToTerms}</Text>
              ) : null}

              <AppButton
                title="Concluir cadastro"
                variant="primary"
                loading={isSubmitting}
                onPress={handleSubmit}
                style={styles.submitButton}
              />

              {errors.general ? (
                <Text style={styles.generalError}>{errors.general}</Text>
              ) : null}
            </View>

            <AuthFooterLink
              promptText="Não é você?"
              actionText="Usar outra conta"
              onPress={handleUseAnotherAccount}
            />

            <View style={styles.logoContainer}>
              <MapeeiLogo />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BrandColors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  headerContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: BrandColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: BrandColors.textSecondary,
    lineHeight: 20,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BrandColors.inputBorder,
    backgroundColor: BrandColors.inputBackground,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.divider,
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountLabel: {
    fontSize: 12,
    color: BrandColors.textSecondary,
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: BrandColors.textPrimary,
  },
  formContainer: {
    width: '100%',
  },
  checkboxContainer: {
    marginVertical: 10,
  },
  termsError: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 8,
    marginLeft: 4,
  },
  submitButton: {
    marginTop: 12,
    marginBottom: 4,
  },
  generalError: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
