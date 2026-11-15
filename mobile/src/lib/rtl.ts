import { TextStyle } from 'react-native';
import { Language } from '../types/domain';

/**
 * Checks if the given language uses Right-to-Left (RTL) script.
 * Only 'Urdu' uses RTL Nastaliq script; 'HindiRoman' and 'UrduRoman' use Latin script (LTR).
 */
export function isRTL(language?: Language | string | null): boolean {
  return language === 'Urdu';
}

/**
 * Returns React Native TextStyle properties for direction and alignment based on language.
 */
export function getRTLTextStyle(language?: Language | string | null): TextStyle {
  if (isRTL(language)) {
    return {
      writingDirection: 'rtl',
      textAlign: 'right',
    };
  }
  return {
    writingDirection: 'ltr',
    textAlign: 'left',
  };
}
