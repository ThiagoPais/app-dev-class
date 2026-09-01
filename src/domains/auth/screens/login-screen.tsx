import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HeaderBanner } from '@/shared/components/header-banner';
import { MapeeiLogo } from '@/shared/components/logo';
import { AppButton, AppCheckbox, AppTextInput, OrDivider } from '@/shared/components/ui';
import { BrandColors } from '@/shared/constants/colors';

import { AuthFooterLink, SocialAuthButton } from '../components';
import { useLoginForm } from '../hooks';

export interface LoginScreenProps {
  onNavigateToSignup?: () => void;
  onNavigateToForgotPassword?: () => void;
  onSocialLogin?: (provider: 'apple' | 'google') => void;
}

export function LoginScreen({
  onNavigateToSignup,
  onNavigateToForgotPassword,
  onSocialLogin,
}: LoginScreenProps) {
  const { values, errors, isSubmitting, handleChange, handleSubmit } = useLoginForm({
    onSubmit: async (data) => {
      console.log('Login submitted:', data);
    },
  });

  const handleSignupNavigation = () => {
    if (onNavigateToSignup) {
      onNavigateToSignup();
    } else {
      router.push('/signup');
    }
  };

  const handleForgotPassword = () => {
    if (onNavigateToForgotPassword) {
      onNavigateToForgotPassword();
    } else {
      console.log('Navigate to forgot password');
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
          <HeaderBanner />

          <View style={styles.content}>
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Bem-vindo(a) de volta!</Text>
              <Text style={styles.subtitle}>
                Entre com suas credenciais para acessar sua conta.
              </Text>
            </View>

            <View style={styles.formContainer}>
              <AppTextInput
                label="E-mail"
                placeholder="Digite seu e-mail"
                keyboardType="email-address"
                autoCapitalize="none"
                value={values.email}
                error={errors.email}
                onChangeText={(text) => handleChange('email', text)}
              />

              <View style={styles.passwordFieldWrapper}>
                <AppTextInput
                  label="Senha"
                  placeholder="Digite sua senha"
                  isPassword
                  value={values.password}
                  error={errors.password}
                  onChangeText={(text) => handleChange('password', text)}
                  containerStyle={styles.passwordInputContainer}
                />
                <Pressable
                  onPress={handleForgotPassword}
                  hitSlop={8}
                  style={styles.forgotPasswordButton}>
                  <Text style={styles.forgotPasswordText}>esqueceu sua senha?</Text>
                </Pressable>
              </View>

              <AppCheckbox
                label="Lembrar de mim"
                checked={values.rememberMe}
                onValueChange={(checked) => handleChange('rememberMe', checked)}
                containerStyle={styles.checkboxContainer}
              />

              <AppButton
                title="Login"
                variant="primary"
                loading={isSubmitting}
                onPress={handleSubmit}
                style={styles.submitButton}
              />
            </View>

            <OrDivider text="Ou" style={styles.divider} />

            <View style={styles.socialButtonsContainer}>
              <SocialAuthButton
                provider="apple"
                title="Inscreva-se com Apple"
                onPress={() => onSocialLogin?.('apple')}
              />
              <SocialAuthButton
                provider="google"
                title="Inscreva-se com Google"
                onPress={() => onSocialLogin?.('google')}
              />
            </View>

            <AuthFooterLink
              promptText="Não tem uma conta?"
              actionText="Crie agora"
              onPress={handleSignupNavigation}
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
  formContainer: {
    width: '100%',
  },
  passwordFieldWrapper: {
    marginBottom: 10,
  },
  passwordInputContainer: {
    marginBottom: 4,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: BrandColors.primary,
  },
  checkboxContainer: {
    marginVertical: 10,
  },
  submitButton: {
    marginTop: 12,
    marginBottom: 4,
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
