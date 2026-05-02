/**
 * ShelfAwareness Design System
 * Consistent tokens for the entire mobile app.
 */

export const palette = {
  // Brand
  primary: '#0E4DA4',
  primaryLight: '#1A6FDC',
  primaryDark: '#0A3880',

  // Accents
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#0284C7',
  infoLight: '#E0F2FE',

  // Neutrals
  white: '#FFFFFF',
  bg: '#F3F6FB',
  surfaceCard: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Dark overlay
  overlay: 'rgba(0,0,0,0.55)',
  overlayLight: 'rgba(0,0,0,0.35)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: palette.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, color: palette.textPrimary, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const, color: palette.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: palette.textPrimary },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, color: palette.textSecondary },
  label: { fontSize: 12, fontWeight: '600' as const, color: palette.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  mono: { fontSize: 13, fontFamily: 'monospace' as const, color: palette.textSecondary },
};
