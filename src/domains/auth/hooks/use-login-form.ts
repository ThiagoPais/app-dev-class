import { useState } from 'react';
import { isValidCpf } from '@/shared/utils/cpf';
import { LoginFormErrors, LoginFormValues } from '../models/auth.types';

export interface UseLoginFormOptions {
  onSubmit?: (values: LoginFormValues) => Promise<void> | void;
}

export function useLoginForm(options?: UseLoginFormOptions) {
  const [values, setValues] = useState<LoginFormValues>({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: LoginFormErrors = {};
    const identifier = values.email.trim();

    if (!identifier) {
      newErrors.email = 'O e-mail ou CPF é obrigatório.';
    } else if (identifier.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        newErrors.email = 'Insira um e-mail válido.';
      }
    } else if (!/^\d+$/.test(identifier)) {
      newErrors.email = 'Insira um e-mail ou CPF válido (somente números).';
    } else if (identifier.length !== 11) {
      newErrors.email = 'O CPF deve conter exatamente 11 dígitos.';
    } else if (!isValidCpf(identifier)) {
      newErrors.email = 'Insira um CPF válido.';
    }

    if (!values.password) {
      newErrors.password = 'A senha é obrigatória.';
    } else if (values.password.length < 6) {
      newErrors.password = 'A senha deve ter no mínimo 6 caracteres.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = <K extends keyof LoginFormValues>(
    field: K,
    value: LoginFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof LoginFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // Clear general error on any field change
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      if (options?.onSubmit) {
        await options.onSubmit(values);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao efetuar login. Tente novamente.';
      setErrors((prev) => ({
        ...prev,
        general: message,
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setValues,
  };
}
