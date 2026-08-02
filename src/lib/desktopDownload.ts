/** Direct link to the latest Windows installer on GitHub Releases. */
const DEFAULT_DOWNLOAD_URL =
  'https://github.com/markreyno/agentdocs/releases/latest/download/agentdocs-Setup.exe'

export function getDesktopDownloadUrl(): string {
  const fromEnv = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return DEFAULT_DOWNLOAD_URL
}

/** Trigger a browser download of the desktop .exe (or env override URL). */
export function openDesktopDownload(): void {
  const url = getDesktopDownloadUrl()
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'agentdocs-Setup.exe'
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
