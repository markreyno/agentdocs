import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { isRendererDocTool } from '../../dist-shared/editTools.js'
import {
  hasWriteIntent,
  latestUserText,
  shouldInjectWriteNudge,
  WRITE_TOOL_NUDGE,
} from '../../dist-shared/writeIntent.js'
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
  const toolsAvailable = Boolean(tools?.length && executeTool)
  const maxIterations = toolsAvailable ? MAX_TOOL_ITERATIONS : 1
  const writeIntent = hasWriteIntent(latestUserText(messages))
  let rendererToolUsed = false
  let writeNudgeInjected = false

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

    if (finalMessage.stop_reason === 'tool_use' && executeTool) {
      const toolResults: ToolResultBlockParam[] = []
      for (const block of finalMessage.content) {
        if (block.type !== 'tool_use') continue
        if (isRendererDocTool(block.name)) rendererToolUsed = true
        onToolUse?.(block.name, block.input)
        const result = await Promise.resolve(executeTool(block.name, block.input as Record<string, unknown>))
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
      }
      convo.push({ role: 'user', content: toolResults })
      continue
    }

    const stoppedWithoutTools =
      finalMessage.stop_reason === 'end_turn' || finalMessage.stop_reason === 'max_tokens'
    if (
      stoppedWithoutTools &&
      shouldInjectWriteNudge({
        toolsAvailable,
        writeIntent,
        rendererToolUsed,
        writeNudgeInjected,
        iteration,
        maxIterations,
      })
    ) {
      writeNudgeInjected = true
      convo.push({ role: 'user', content: WRITE_TOOL_NUDGE })
      continue
    }

    return
  }
}
