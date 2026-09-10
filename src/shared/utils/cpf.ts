/**
 * Strips all non-digit characters from a CPF string.
 * @example sanitizeCpf('123.456.789-09') => '12345678909'
 */
export function sanitizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Applies the CPF display mask (000.000.000-00) as the user types.
 * @example formatCpf('12345678909') => '123.456.789-09'
 */
export function formatCpf(value: string): string {
  const digits = sanitizeCpf(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Validates a Brazilian CPF using the Modulo 11 check-digit algorithm.
 * Rejects strings with all identical digits (e.g. 111.111.111-11).
 */
export function isValidCpf(value: string): boolean {
  const cpf = sanitizeCpf(value);

  if (cpf.length !== 11) return false;

  // Reject all-identical digits (e.g. 000.000.000-00, 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9), 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}
