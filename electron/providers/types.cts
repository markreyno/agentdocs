export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Provider-agnostic tool schema (JSON Schema `input_schema`), mapped to each provider's own wire format. */
export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: readonly string[]
  }
}

export type ToolExecutor = (name: string, input: Record<string, unknown>) => unknown | Promise<unknown>

export interface ProviderStreamParams {
  apiKey?: string
  model: string
  messages: ChatMessage[]
  /** Opt into provider prompt caching when the provider supports it. */
  promptCaching?: boolean
  signal: AbortSignal
  onDelta: (text: string) => void
  /** Doc search/lookup tools available this turn, present only when a document tree was supplied. */
  tools?: ToolDefinition[]
  executeTool?: ToolExecutor
  /** Fired when the model calls a tool, for a "Searching…" style indicator. */
  onToolUse?: (name: string, input: unknown) => void
}

export type ProviderStreamFn = (params: ProviderStreamParams) => Promise<void>

export interface ProviderDescriptor {
  id: ProviderId
  label: string
  requiresApiKey: boolean
  defaultModel: string
}

export const PROVIDERS: ProviderDescriptor[] = [
  { id: 'anthropic', label: 'Claude (Anthropic)', requiresApiKey: true, defaultModel: 'claude-sonnet-5' },
  { id: 'openai', label: 'GPT (OpenAI)', requiresApiKey: true, defaultModel: 'gpt-4o' },
  { id: 'gemini', label: 'Gemini (Google)', requiresApiKey: true, defaultModel: 'gemini-2.5-flash' },
  { id: 'ollama', label: 'Ollama (local)', requiresApiKey: false, defaultModel: 'llama3.2' },
]
