// Design System Constants
export const COLORS = {
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  primaryDark: '#4F48CC',

  accent: '#43D9AD',
  accentWarn: '#FFB347',
  accentDanger: '#FF6584',

  bg: '#0F0F1A',
  bgCard: '#1A1A2E',
  bgCardHover: '#22223A',
  bgOverlay: 'rgba(15, 15, 26, 0.95)',

  text: '#FFFFFF',
  textSecondary: '#A0A0C0',
  textMuted: '#666680',

  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',

  success: '#43D9AD',
  warning: '#FFB347',
  error: '#FF6584',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FONT = {
  regular: { fontWeight: '400' as const },
  medium: { fontWeight: '500' as const },
  semibold: { fontWeight: '600' as const },
  bold: { fontWeight: '700' as const },
  heavy: { fontWeight: '800' as const },
};

export const SHADOW = {
  card: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
};
