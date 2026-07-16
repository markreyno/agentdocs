/** Letter page size at 96dpi (11in × 8.5in). */
export const PAGE_HEIGHT_PX = 1056
export const PAGE_WIDTH_PX = 816
/** 1in margins. */
export const PAGE_MARGIN_PX = 96
/** Visual gap between stacked page sheets. */
export const PAGE_GAP_PX = 24
/** Extra space under the page header band before body text. */
export const PAGE_HEADER_CONTENT_GAP_PX = 8

export function canvasColorForTheme(theme: 'light' | 'dark') {
  return theme === 'dark' ? '#1a1b22' : '#f3f4f6'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Header HTML for each page: title when set, otherwise an empty spacer band. */
export function pageHeaderLeftHtml(title?: string) {
  const trimmed = title?.trim()
  if (trimmed && trimmed !== 'Untitled document') {
    return `<span class="page-header-title">${escapeHtml(trimmed)}</span>`
  }
  return '<span class="page-header-spacer" aria-hidden="true">&nbsp;</span>'
}
