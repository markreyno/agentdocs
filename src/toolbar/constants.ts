export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export const DEFAULT_TEXT_COLOR = '#000000'
export const DEFAULT_TEXT_COLOR_DARK = '#ffffff'

export function defaultTextColorForTheme(theme: 'light' | 'dark') {
  return theme === 'dark' ? DEFAULT_TEXT_COLOR_DARK : DEFAULT_TEXT_COLOR
}

export const TEXT_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#ffffff' },
  { label: 'Dark red', value: '#c00000' },
  { label: 'Blue', value: '#0078d4' },
  { label: 'Green', value: '#107c10' },
  { label: 'Grey', value: '#6b7280' },
] as const

export const FONT_FAMILIES = [
  { label: 'Aptos', value: 'Aptos, Calibri, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
] as const

export const FONT_SIZES = [
  { label: '8', value: '8px' },
  { label: '9', value: '9px' },
  { label: '10', value: '10px' },
  { label: '11', value: '11px' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
] as const

export const TEXT_ALIGNS = [
  { label: 'Align left', value: 'left' },
  { label: 'Align center', value: 'center' },
  { label: 'Align right', value: 'right' },
  { label: 'Justify', value: 'justify' },
] as const

export const HIGHLIGHT_COLOR = '#ffec99'

export const LINE_HEIGHTS = [
  { label: 'Single', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2' },
] as const
