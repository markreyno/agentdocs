import Anthropic from '@anthropic-ai/sdk'
import type { ProviderStreamFn } from './types.cjs'

export const streamAnthropic: ProviderStreamFn = async ({
  apiKey,
  model,
  messages,
  promptCaching,
  signal,
  onDelta,
}) => {
  if (!apiKey) throw new Error('No Anthropic API key configured. Add one in Settings.')

  const client = new Anthropic({ apiKey })
  const stream = client.messages.stream(
    {
      model,
      max_tokens: 4096,
      messages,
      // Top-level cache_control opts into automatic prompt caching for multi-turn chats.
      ...(promptCaching ? { cache_control: { type: 'ephemeral' as const } } : {}),
    },
    { signal },
  )

  stream.on('text', onDelta)
  await stream.finalMessage()
}
