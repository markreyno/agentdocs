import type { ProviderId } from './providers'

/** Providers that support an explicit prompt-caching opt-in. */
export const CACHABLE_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const
export type CachableProviderId = (typeof CACHABLE_PROVIDERS)[number]

interface ProviderSettings {
  activeProvider: ProviderId
  models: Partial<Record<ProviderId, string>>
  /** When true, requests opt into provider prompt caching where supported. */
  promptCaching: Partial<Record<CachableProviderId, boolean>>
}

const SETTINGS_KEY = 'agentdocs:providerSettings'

const FALLBACK_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
  ollama: 'llama3.2',
}

function readSettings(): ProviderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProviderSettings>
      return {
        activeProvider: parsed.activeProvider ?? 'anthropic',
        models: parsed.models ?? {},
        promptCaching: parsed.promptCaching ?? {},
      }
    }
  } catch {
    // fall through to defaults
  }
  return { activeProvider: 'anthropic', models: {}, promptCaching: {} }
}

function writeSettings(settings: ProviderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function getActiveProvider(): ProviderId {
  return readSettings().activeProvider
}

export function setActiveProvider(provider: ProviderId) {
  writeSettings({ ...readSettings(), activeProvider: provider })
}

export function getModelFor(provider: ProviderId): string {
  return readSettings().models[provider] ?? FALLBACK_MODELS[provider]
}

export function setModelFor(provider: ProviderId, model: string) {
  const settings = readSettings()
  writeSettings({ ...settings, models: { ...settings.models, [provider]: model } })
}

export function getPromptCachingEnabled(provider: CachableProviderId): boolean {
  return readSettings().promptCaching[provider] ?? false
}

export function setPromptCachingEnabled(provider: CachableProviderId, enabled: boolean) {
  const settings = readSettings()
  writeSettings({
    ...settings,
    promptCaching: { ...settings.promptCaching, [provider]: enabled },
  })
}
