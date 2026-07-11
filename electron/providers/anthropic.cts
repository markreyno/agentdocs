import Anthropic from '@anthropic-ai/sdk'
import type { ProviderStreamFn } from './types.cjs'

export const streamAnthropic: ProviderStreamFn = async ({ apiKey, model, messages, signal, onDelta }) => {
  if (!apiKey) throw new Error('No Anthropic API key configured. Add one in Settings.')

  const client = new Anthropic({ apiKey })
  const stream = client.messages.stream(
    { model, max_tokens: 4096, messages },
    { signal },
  )

  stream.on('text', onDelta)
  await stream.finalMessage()
}
