import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProviderDescriptor, ProviderId } from './lib/providers'
import { ensureOllamaWhenSelected } from './lib/ollama'
import {
  CACHABLE_PROVIDERS,
  getActiveProvider,
  getModelFor,
  getPromptCachingEnabled,
  setActiveProvider,
  setModelFor,
  setPromptCachingEnabled,
  type CachableProviderId,
} from './lib/providerSettings'

interface ProviderSettingsPanelProps {
  onClose: () => void
}

const CACHING_HELP: Record<CachableProviderId, string> = {
  anthropic:
    'Marks prompts for Anthropic prompt caching to cut cost and latency on repeated context.',
  openai:
    'OpenAI caches eligible prompts automatically; this improves cache hit rates via a stable cache key.',
  gemini:
    'Gemini 2.5+ applies implicit caching automatically for eligible prompts. Explicit cache objects are not used yet.',
}

function isCachable(id: ProviderId): id is CachableProviderId {
  return (CACHABLE_PROVIDERS as readonly string[]).includes(id)
}

export default function ProviderSettingsPanel({ onClose }: ProviderSettingsPanelProps) {
  const [providers, setProviders] = useState<ProviderDescriptor[]>([])
  const [keyStatus, setKeyStatus] = useState<Record<ProviderId, boolean>>({
    anthropic: false,
    openai: false,
    gemini: false,
    ollama: true,
  })
  const [activeProvider, setActive] = useState<ProviderId>(getActiveProvider())
  const [keyInputs, setKeyInputs] = useState<Partial<Record<ProviderId, string>>>({})
  const [ollamaModel, setOllamaModel] = useState(() => getModelFor('ollama'))
  const [ollamaModels, setOllamaModels] = useState<{ name: string; supportsTools: boolean }[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [savedNotice, setSavedNotice] = useState<ProviderId | null>(null)
  const [promptCaching, setPromptCaching] = useState<Partial<Record<CachableProviderId, boolean>>>(() => {
    const initial: Partial<Record<CachableProviderId, boolean>> = {}
    for (const id of CACHABLE_PROVIDERS) {
      initial[id] = getPromptCachingEnabled(id)
    }
    return initial
  })

  const applyOllamaModels = (listed: { name: string; supportsTools: boolean }[]) => {
    setOllamaModels(listed)
    const toolModels = listed.filter((m) => m.supportsTools).map((m) => m.name)
    if (toolModels.length === 0) return
    const current = getModelFor('ollama')
    if (!toolModels.includes(current)) {
      const next = toolModels[0]
      setModelFor('ollama', next)
      setOllamaModel(next)
    } else {
      setOllamaModel(current)
    }
  }

  const refreshOllamaModels = async () => {
    setOllamaLoading(true)
    try {
      // Start Ollama if needed so we can list local models for the selector.
      await window.agentdocs?.ollama.ensureRunning()
      const listed = (await window.agentdocs?.ollama.models()) ?? []
      applyOllamaModels(listed)
    } finally {
      setOllamaLoading(false)
    }
  }

  useEffect(() => {
    window.agentdocs?.providers.list().then(setProviders)
    window.agentdocs?.keys.status().then(setKeyStatus)
    void refreshOllamaModels()
  }, [])

  const handleActivate = async (provider: ProviderId) => {
    setActive(provider)
    setActiveProvider(provider)
    if (provider === 'ollama') {
      await ensureOllamaWhenSelected('ollama')
      await refreshOllamaModels()
    }
  }

  const handleModelChange = (provider: ProviderId, model: string) => {
    setModelFor(provider, model)
  }

  const handleOllamaModelChange = (model: string) => {
    setOllamaModel(model)
    setModelFor('ollama', model)
  }

  const handleCachingChange = (provider: CachableProviderId, enabled: boolean) => {
    setPromptCaching((prev) => ({ ...prev, [provider]: enabled }))
    setPromptCachingEnabled(provider, enabled)
  }

  const handleSaveKey = async (provider: ProviderId) => {
    const value = keyInputs[provider]?.trim()
    if (!value) return
    await window.agentdocs?.keys.set(provider, value)
    setKeyInputs((prev) => ({ ...prev, [provider]: '' }))
    setKeyStatus((prev) => ({ ...prev, [provider]: true }))
    setSavedNotice(provider)
    setTimeout(() => setSavedNotice(null), 2000)
  }

  const handleRemoveKey = async (provider: ProviderId) => {
    await window.agentdocs?.keys.delete(provider)
    setKeyStatus((prev) => ({ ...prev, [provider]: false }))
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 font-sans">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-sm text-gray-800">Settings</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="text-gray-400 hover:text-gray-700 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-500">Model providers</p>
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={`border rounded-md p-3 ${
                activeProvider === provider.id ? 'border-indigo-400 bg-indigo-50/40' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="active-provider"
                    checked={activeProvider === provider.id}
                    onChange={() => handleActivate(provider.id)}
                  />
                  {provider.label}
                </label>
                {provider.requiresApiKey && (
                  <span className={`text-xs ${keyStatus[provider.id] ? 'text-green-600' : 'text-gray-400'}`}>
                    {keyStatus[provider.id] ? 'Key saved' : 'No key set'}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {provider.id === 'ollama' ? (
                  <OllamaModelSelect
                    models={ollamaModels}
                    loading={ollamaLoading}
                    value={ollamaModel}
                    onChange={handleOllamaModelChange}
                    onRefresh={() => void refreshOllamaModels()}
                  />
                ) : (
                  <input
                    type="text"
                    defaultValue={getModelFor(provider.id)}
                    onBlur={(e) => handleModelChange(provider.id, e.target.value.trim() || provider.defaultModel)}
                    placeholder="Model name"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                  />
                )}

                {provider.requiresApiKey && (
                  <div className="flex gap-1.5">
                    <input
                      type="password"
                      value={keyInputs[provider.id] ?? ''}
                      onChange={(e) => setKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                      placeholder="Paste API key"
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveKey(provider.id)}
                      className="text-xs bg-indigo-600 text-white rounded px-2.5 cursor-pointer hover:bg-indigo-700"
                    >
                      Save
                    </button>
                    {keyStatus[provider.id] && (
                      <button
                        type="button"
                        onClick={() => handleRemoveKey(provider.id)}
                        className="text-xs text-gray-500 hover:text-red-600 cursor-pointer px-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}

                {isCachable(provider.id) && (
                  <CachingOption
                    providerId={provider.id}
                    enabled={Boolean(promptCaching[provider.id])}
                    onChange={handleCachingChange}
                  />
                )}

                {savedNotice === provider.id && <p className="text-xs text-green-600">Saved.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function OllamaModelSelect({
  models,
  loading,
  value,
  onChange,
  onRefresh,
}: {
  models: { name: string; supportsTools: boolean }[]
  loading: boolean
  value: string
  onChange: (model: string) => void
  onRefresh: () => void
}) {
  const toolModels = models.filter((m) => m.supportsTools)
  const RefreshButton = (
    <button type="button" onClick={onRefresh} className="text-indigo-600 cursor-pointer" disabled={loading}>
      {loading ? 'loading…' : 'refresh'}
    </button>
  )

  if (loading && models.length === 0) {
    return <p className="text-xs text-gray-500">Detecting local models…</p>
  }

  if (toolModels.length === 0) {
    return (
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          No downloaded models with tool calling. Pull one (e.g.{' '}
          <code className="font-mono">ollama pull llama3.2</code>) and {RefreshButton}.
        </p>
        {models.length > 0 && (
          <p className="text-gray-400">
            Installed without tools: {models.map((m) => m.name).join(', ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <select
          value={toolModels.some((m) => m.name === value) ? value : toolModels[0].name}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-white"
          aria-label="Ollama model"
        >
          {toolModels.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500 shrink-0">{RefreshButton}</span>
      </div>
      <p className="text-xs text-gray-500">Only local models that support tool calling are listed.</p>
    </div>
  )
}

function CachingOption({
  providerId,
  enabled,
  onChange,
}: {
  providerId: CachableProviderId
  enabled: boolean
  onChange: (provider: CachableProviderId, enabled: boolean) => void
}) {
  if (providerId === 'gemini') {
    return (
      <div className="pt-1.5 border-t border-gray-100 mt-2">
        <p className="text-xs text-gray-500 leading-snug">{CACHING_HELP.gemini}</p>
      </div>
    )
  }

  return (
    <div className="pt-1.5 border-t border-gray-100 mt-2">
      <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          onChange={(e) => onChange(providerId, e.target.checked)}
        />
        <span>
          <span className="font-medium text-gray-800">Enable prompt caching</span>
          <span className="block text-gray-500 mt-0.5 leading-snug">{CACHING_HELP[providerId]}</span>
        </span>
      </label>
    </div>
  )
}
