const DEFAULT_DOWNLOAD_URL = 'https://github.com/markreyno/agentdocs/releases'

export function getDesktopDownloadUrl(): string {
  const fromEnv = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return DEFAULT_DOWNLOAD_URL
}

export function openDesktopDownload(): void {
  window.open(getDesktopDownloadUrl(), '_blank', 'noopener,noreferrer')
}
