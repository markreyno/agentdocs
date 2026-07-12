import { OLLAMA_BASE_URL } from '../ollamaService.cjs'
import type { ProviderStreamFn } from './types.cjs'

export const streamOllama: ProviderStreamFn = async ({ model, messages, signal, onDelta }) => {
  let response: Response
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    })
  } catch {
    throw new Error('Could not reach Ollama. Is it running locally on port 11434?')
  }

  if (!response.ok || !response.body) {
    throw new Error(`Ollama request failed (${response.status}). Is "${model}" pulled locally?`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        if (parsed.message?.content) onDelta(parsed.message.content as string)
      } catch {
        // ignore malformed line
      }
    }
  }
}

export async function listOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    if (!response.ok) return []
    const data = (await response.json()) as { models?: { name: string }[] }
    return data.models?.map((m) => m.name) ?? []
  } catch {
    return []
  }
}
