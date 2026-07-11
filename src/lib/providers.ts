export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama'

export interface ProviderDescriptor {
  id: ProviderId
  label: string
  requiresApiKey: boolean
  defaultModel: string
}
