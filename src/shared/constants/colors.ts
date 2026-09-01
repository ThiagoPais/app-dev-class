export const BrandColors = {
  primary: '#832D51',
  secondary: '#E96E97',
  background: '#FFFFFF',
  inputBackground: '#F8F9FB',
  inputBorder: '#E8E8EC',
  inputFocusBorder: '#832D51',
  textPrimary: '#171717',
  textSecondary: '#737373',
  textMuted: '#A3A3A3',
  placeholder: '#9CA3AF',
  white: '#FFFFFF',
  divider: '#EEEEEE',
  checkboxBorder: '#262626',
  socialButtonBorder: '#E5E7EB',
  socialButtonBg: '#FFFFFF',
  shadowColor: '#832D51',
} as const;

export type BrandColorKey = keyof typeof BrandColors;
