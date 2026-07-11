import type { ProviderId } from './providers'

interface ProviderSettings {
  activeProvider: ProviderId
  models: Partial<Record<ProviderId, string>>
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
    if (raw) return JSON.parse(raw) as ProviderSettings
  } catch {
    // fall through to defaults
  }
  return { activeProvider: 'anthropic', models: {} }
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
