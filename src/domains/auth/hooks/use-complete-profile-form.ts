import { useState } from 'react';
import { formatCpf, isValidCpf, sanitizeCpf } from '@/shared/utils/cpf';
import { CompleteProfileFormErrors, CompleteProfileFormValues } from '../models/auth.types';

export interface UseCompleteProfileFormOptions {
  initialName?: string;
  onSubmit?: (values: CompleteProfileFormValues) => Promise<void> | void;
}

export function useCompleteProfileForm(options?: UseCompleteProfileFormOptions) {
  const [values, setValues] = useState<CompleteProfileFormValues>({
    name: options?.initialName ?? '',
    cpf: '',
    agreeToTerms: false,
  });

  const [errors, setErrors] = useState<CompleteProfileFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: CompleteProfileFormErrors = {};

    if (!values.name.trim()) {
      newErrors.name = 'O nome é obrigatório.';
    }

    const rawCpf = sanitizeCpf(values.cpf);
    if (!rawCpf) {
      newErrors.cpf = 'O CPF é obrigatório.';
    } else if (!isValidCpf(rawCpf)) {
      newErrors.cpf = 'Insira um CPF válido.';
    }

    if (!values.agreeToTerms) {
      newErrors.agreeToTerms = 'Você deve concordar com os termos de uso.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = <K extends keyof CompleteProfileFormValues>(
    field: K,
    value: CompleteProfileFormValues[K]
  ) => {
    // Apply CPF mask in real-time
    if (field === 'cpf' && typeof value === 'string') {
      const masked = formatCpf(value);
      setValues((prev) => ({ ...prev, cpf: masked }));
    } else {
      setValues((prev) => ({ ...prev, [field]: value }));
    }

    if (errors[field as keyof CompleteProfileFormErrors]) {
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
      const message = err instanceof Error ? err.message : 'Erro ao concluir cadastro. Tente novamente.';
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
  };
}
