import type { Theme } from '../context/ThemeContext.js';

export const ZIP_RIVE_SRC = '/zip.riv';
export const ZIP_VIEW_MODEL = 'ZipIcon';
export const ZIP_INSTANCE_NAME = 'Instance';

/** Semantic token used for bulk bar icon color: --color-text-primary */
export const ZIP_ICON_COLOR_TOKEN = '--color-text-primary';

/** Hex values from design tokens (--color-text-primary → primitive brand scale). */
export const ZIP_ICON_COLOR_HEX_BY_THEME: Record<Theme, string> = {
  light: '#171717', // --primitive-brand-900
  dark: '#f5f5f5', // --primitive-brand-100
};

export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
