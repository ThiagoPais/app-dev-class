import { useState } from 'react';
import { SignupFormErrors, SignupFormValues } from '../models/auth.types';

export interface UseSignupFormOptions {
  onSubmit?: (values: SignupFormValues) => Promise<void> | void;
}

export function useSignupForm(options?: UseSignupFormOptions) {
  const [values, setValues] = useState<SignupFormValues>({
    name: '',
    email: '',
    password: '',
    agreeToTerms: false,
  });

  const [errors, setErrors] = useState<SignupFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: SignupFormErrors = {};

    if (!values.name.trim()) {
      newErrors.name = 'O nome é obrigatório.';
    }

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

    if (!values.agreeToTerms) {
      newErrors.agreeToTerms = 'Você deve concordar com os termos de uso.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = <K extends keyof SignupFormValues>(
    field: K,
    value: SignupFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof SignupFormErrors]) {
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
        email: 'Erro ao efetuar cadastro. Tente novamente.',
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
