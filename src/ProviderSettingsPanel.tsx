import { useEffect, useState } from 'react'
import type { ProviderDescriptor, ProviderId } from './lib/providers'
import { getActiveProvider, getModelFor, setActiveProvider, setModelFor } from './lib/providerSettings'

interface ProviderSettingsPanelProps {
  onClose: () => void
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
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [savedNotice, setSavedNotice] = useState<ProviderId | null>(null)

  useEffect(() => {
    window.agentdocs?.providers.list().then(setProviders)
    window.agentdocs?.keys.status().then(setKeyStatus)
    window.agentdocs?.ollama.models().then(setOllamaModels)
  }, [])

  const refreshOllamaModels = () => {
    window.agentdocs?.ollama.models().then(setOllamaModels)
  }

  const handleActivate = (provider: ProviderId) => {
    setActive(provider)
    setActiveProvider(provider)
  }

  const handleModelChange = (provider: ProviderId, model: string) => {
    setModelFor(provider, model)
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 font-sans">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-semibold text-sm text-gray-800">Model providers</span>
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
                <input
                  type="text"
                  defaultValue={getModelFor(provider.id)}
                  onBlur={(e) => handleModelChange(provider.id, e.target.value.trim() || provider.defaultModel)}
                  placeholder="Model name"
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                />

                {provider.requiresApiKey ? (
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
                ) : (
                  <div className="text-xs text-gray-500">
                    {ollamaModels.length > 0 ? (
                      <>
                        Detected local models: {ollamaModels.join(', ')}{' '}
                        <button type="button" onClick={refreshOllamaModels} className="text-indigo-600 cursor-pointer">
                          refresh
                        </button>
                      </>
                    ) : (
                      <>
                        No local models found. Run <code className="font-mono">ollama pull llama3.2</code> and{' '}
                        <button type="button" onClick={refreshOllamaModels} className="text-indigo-600 cursor-pointer">
                          refresh
                        </button>
                        .
                      </>
                    )}
                  </div>
                )}

                {savedNotice === provider.id && <p className="text-xs text-green-600">Saved.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
