import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { HeaderBanner } from '@/shared/components/header-banner';
import { MapeeiLogo } from '@/shared/components/logo';
import { AppButton, AppCheckbox, AppTextInput, OrDivider } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { AuthFooterLink, SocialAuthButton } from '../components';
import { useAuth } from '../hooks/use-auth';
import { useSignupForm } from '../hooks';

export interface SignupScreenProps {
  onNavigateToLogin?: () => void;
  onSocialSignup?: (provider: 'apple' | 'google') => void;
}

export function SignupScreen({
  onNavigateToLogin,
  onSocialSignup,
}: SignupScreenProps) {
  const { signup } = useAuth();

  const { values, errors, isSubmitting, handleChange, handleSubmit } = useSignupForm({
    onSubmit: async (data) => {
      await signup(data);
      router.replace('/(logged)/(tabs)/landingPage');
    },
  });

  const handleLoginNavigation = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      router.push('/login');
    }
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
          {/* Top Banner */}
          <HeaderBanner />

          {/* Main Card / Content */}
          <View style={styles.content}>
            {/* Header Title */}
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Comece agora com o</Text>
              <Text style={styles.title}>mapeei!</Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              <AppTextInput
                label="Nome"
                placeholder="Digite seu nome"
                value={values.name}
                error={errors.name}
                onChangeText={(text) => handleChange('name', text)}
              />

              <AppTextInput
                label="E-mail"
                placeholder="Digite seu e-mail"
                keyboardType="email-address"
                autoCapitalize="none"
                value={values.email}
                error={errors.email}
                onChangeText={(text) => handleChange('email', text)}
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

              <AppTextInput
                label="Senha"
                placeholder="Digite uma senha"
                isPassword
                value={values.password}
                error={errors.password}
                onChangeText={(text) => handleChange('password', text)}
              />

              {/* Terms Checkbox */}
              <AppCheckbox
                label="Li e concordo com os termos de uso"
                checked={values.agreeToTerms}
                onValueChange={(checked) => handleChange('agreeToTerms', checked)}
                containerStyle={styles.checkboxContainer}
              />
              {errors.agreeToTerms ? (
                <Text style={styles.termsError}>{errors.agreeToTerms}</Text>
              ) : null}

              {/* Submit Button */}
              <AppButton
                title="Inscreva-se"
                variant="primary"
                loading={isSubmitting}
                onPress={handleSubmit}
                style={styles.submitButton}
              />

              {errors.general ? (
                <Text style={styles.generalError}>{errors.general}</Text>
              ) : null}
            </View>

            {/* Or Divider */}
            <OrDivider text="Ou" style={styles.divider} />

            {/* Social Buttons */}
            <View style={styles.socialButtonsContainer}>
              <SocialAuthButton
                provider="apple"
                title="Inscreva-se com Apple"
                onPress={() => onSocialSignup?.('apple')}
              />
              <SocialAuthButton
                provider="google"
                title="Inscreva-se com Google"
                onPress={() => onSocialSignup?.('google')}
              />
            </View>

            {/* Footer Navigation */}
            <AuthFooterLink
              promptText="Já possui uma conta?"
              actionText="Entre"
              onPress={handleLoginNavigation}
            />

            {/* Logo Branding */}
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
    lineHeight: 34,
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
  divider: {
    marginVertical: 12,
  },
  socialButtonsContainer: {
    width: '100%',
    gap: 8,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
