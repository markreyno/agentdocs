import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { ProviderStreamFn } from './types.cjs'

const MAX_TOOL_ITERATIONS = 6

export const streamAnthropic: ProviderStreamFn = async ({
  apiKey,
  model,
  messages,
  promptCaching,
  signal,
  onDelta,
  tools,
  executeTool,
  onToolUse,
}) => {
  if (!apiKey) throw new Error('No Anthropic API key configured. Add one in Settings.')

  const client = new Anthropic({ apiKey })
  const convo: MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))
  const maxIterations = tools?.length && executeTool ? MAX_TOOL_ITERATIONS : 1

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: 4096,
        messages: convo,
        // Top-level cache_control opts into automatic prompt caching for multi-turn chats.
        ...(promptCaching ? { cache_control: { type: 'ephemeral' as const } } : {}),
        ...(tools?.length ? { tools: tools as unknown as Anthropic.Tool[] } : {}),
      },
      { signal },
    )

    stream.on('text', onDelta)
    const finalMessage = await stream.finalMessage()
    convo.push({ role: 'assistant', content: finalMessage.content })

    if (finalMessage.stop_reason !== 'tool_use' || !executeTool) return

    const toolResults: ToolResultBlockParam[] = []
    for (const block of finalMessage.content) {
      if (block.type !== 'tool_use') continue
      onToolUse?.(block.name, block.input)
      const result = await Promise.resolve(executeTool(block.name, block.input as Record<string, unknown>))
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
    }
    convo.push({ role: 'user', content: toolResults })
  }
}
