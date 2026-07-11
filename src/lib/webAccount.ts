/** Base URL for the agentdocs web app (billing, sign-in, cloud account). */
export function getWebAppOrigin(): string {
  const fromEnv = import.meta.env.VITE_WEB_APP_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '')
  }
  return 'http://localhost:5173'
}

export function getWebSignInUrl(): string {
  return `${getWebAppOrigin()}/#signin`
}

export function getWebDashboardUrl(section?: string): string {
  const base = `${getWebAppOrigin()}/#dashboard`
  return section ? `${base}/${section}` : base
}

/** Opens the web sign-in page in the system browser (desktop) or a new tab (web). */
export async function openWebSignIn(): Promise<void> {
  const url = getWebSignInUrl()
  if (window.agentdocs?.shell?.openExternal) {
    await window.agentdocs.shell.openExternal(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function openWebDashboard(section?: string): Promise<void> {
  const url = getWebDashboardUrl(section)
  if (window.agentdocs?.shell?.openExternal) {
    await window.agentdocs.shell.openExternal(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
