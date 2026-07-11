import { streamAnthropic } from './anthropic.cjs'
import { streamGemini } from './gemini.cjs'
import { listOllamaModels, streamOllama } from './ollama.cjs'
import { streamOpenAI } from './openai.cjs'
import type { ProviderId, ProviderStreamFn } from './types.cjs'

export { PROVIDERS } from './types.cjs'
export { listOllamaModels }

const STREAM_FNS: Record<ProviderId, ProviderStreamFn> = {
  anthropic: streamAnthropic,
  openai: streamOpenAI,
  gemini: streamGemini,
  ollama: streamOllama,
}

export function getStreamFn(provider: ProviderId): ProviderStreamFn {
  return STREAM_FNS[provider]
}
