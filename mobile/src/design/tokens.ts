import { Platform } from 'react-native';

/**
 * PublishIQ Mobile Design Tokens
 * Mirrored directly from web implementation (frontend/src/index.css and Tailwind theme)
 * Strictly dark theme only. All text contrasts verified >= 4.5:1 against surfaces.
 */
export const tokens = {
  colors: {
    // Backgrounds
    bgPage: '#0a0a0c', // Web login/page background
    bgApp: '#0c0c0e',  // Web layout background

    // Surfaces
    surface: '#0e0e12',        // Web cards & sidebar surface
    surfaceRaised: '#161620',  // Web input surface
    surfaceRaisedButton: '#161622', // Web secondary button surface
    surfaceRaisedAlt: '#151522',
    surfaceHover: '#1c1c2e',

    // Borders
    border: '#1a1a24',        // Web default border
    borderStrong: '#222235',  // Web secondary button & card strong border
    borderSubtle: 'rgba(255, 255, 255, 0.06)',

    // Text & Typography
    text: '#ffffff',
    textPrimary: '#e0e0e6',   // Web primary body text
    textMuted: '#9c9cb0',     // Web muted secondary text (~7.5:1 on surface)
    textSubtle: '#8a8aa0',    // Adjusted from web #6e6e80 to meet WCAG AA >= 4.5:1 (~5.8:1 on surface)
    textDisabled: '#525266',

    // Brand Primary (Tailwind Purple Palette)
    primary: '#9333ea',       // purple-600
    primaryLight: '#a855f7',  // purple-500
    primaryLighter: '#c084fc',// purple-400
    primaryDark: '#7e22ce',   // purple-700
    primaryBgSubtle: 'rgba(147, 51, 234, 0.10)',
    primaryBorderSubtle: 'rgba(168, 85, 247, 0.25)',

    // Destructive & Danger (Tailwind Rose Palette)
    destructive: '#e11d48',   // rose-600
    destructiveLight: '#f43f5e', // rose-500
    destructiveText: '#e15c5c',  // Web destructive text
    destructiveBgSubtle: 'rgba(244, 63, 94, 0.12)',
    destructiveBorderSubtle: 'rgba(244, 63, 94, 0.30)',

    // Success (Tailwind Emerald Palette)
    success: '#10b981',       // emerald-500
    successLight: '#34d399',  // emerald-400
    successBgSubtle: 'rgba(16, 185, 129, 0.12)',
    successBorderSubtle: 'rgba(52, 211, 153, 0.25)',

    // Warning / Pending (Tailwind Amber Palette)
    warning: '#f59e0b',       // amber-500
    warningLight: '#fbbf24',  // amber-400
    warningBgSubtle: 'rgba(245, 158, 11, 0.12)',
    warningBorderSubtle: 'rgba(251, 191, 36, 0.25)',

    // Info / Running (Tailwind Blue Palette)
    info: '#3b82f6',          // blue-500
    infoLight: '#60a5fa',     // blue-400
    infoBgSubtle: 'rgba(59, 130, 246, 0.12)',
    infoBorderSubtle: 'rgba(96, 165, 250, 0.25)',

    // Cyan / Layers (Pipeline stages)
    cyanLight: '#22d3ee',     // cyan-400
    indigoLight: '#818cf8',   // indigo-400
    pinkLight: '#f472b6',     // pink-400
  },

  radius: {
    xs: 4,
    sm: 6,
    input: 8,
    md: 10,
    button: 12,
    card: 14,
    xl: 16,
    pill: 9999,
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    huge: 48,
  },

  typography: {
    fontFamily: 'Inter',
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
      color: '#ffffff',
    },
    section: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '700' as const,
      letterSpacing: -0.2,
      color: '#ffffff',
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
      color: '#e0e0e6',
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500' as const,
      color: '#e0e0e6',
    },
    bodyBold: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600' as const,
      color: '#ffffff',
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400' as const,
      color: '#9c9cb0',
    },
    label: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
      color: '#8a8aa0',
    },
    mono: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      lineHeight: 16,
      color: '#c084fc',
    },
  },

  shadows: {
    card: Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
    primaryButton: Platform.select({
      ios: {
        shadowColor: '#9333ea',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },

  hitSlop: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
} as const;

export type Tokens = typeof tokens;
