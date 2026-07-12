import type { ProviderId } from './providers'
import { isDesktopApp } from './isDesktop'
import { getActiveProvider } from './providerSettings'

export interface OllamaEnsureResult {
  started: boolean
  available: boolean
}

/** Starts Ollama when it is the selected provider (desktop only). */
export async function ensureOllamaWhenSelected(provider?: ProviderId): Promise<OllamaEnsureResult | null> {
  const active = provider ?? getActiveProvider()
  if (active !== 'ollama' || !isDesktopApp()) return null
  return window.agentdocs!.ollama.ensureRunning()
}
