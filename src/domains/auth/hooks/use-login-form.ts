import { useState } from 'react';
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

    if (!values.email.trim()) {
      newErrors.email = 'O e-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      newErrors.email = 'Insira um e-mail válido.';
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
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      if (options?.onSubmit) {
        await options.onSubmit(values);
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        password: 'Erro ao efetuar login. Tente novamente.',
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
