import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { JSONContent } from '@tiptap/core'
import { buildDocTree } from '../../shared/docTree.js'
import { DOC_TOOLS, executeDocTool } from '../../shared/docTools.js'
import { isRendererDocTool } from '../../shared/editTools.js'
import {
  hasWriteIntent,
  latestUserText,
  shouldInjectWriteNudge,
  WRITE_TOOL_NUDGE,
} from '../../shared/writeIntent.js'
import {
  DEMO_ENABLED,
  DEMO_MAX_MESSAGES,
  DEMO_MAX_MESSAGE_CHARS,
  DEMO_MAX_TOKENS,
  DEMO_MAX_TOOL_ITERATIONS,
  DEMO_MODEL,
} from './config.js'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function validateChatMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > DEMO_MAX_MESSAGES) {
    return false
  }
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false
    if (typeof m.content !== 'string') return false
    if (m.content.length === 0 || m.content.length > DEMO_MAX_MESSAGE_CHARS) return false
  }
  return true
}

export function getAnthropic(): Anthropic | null {
  if (!DEMO_ENABLED) return null
  return new Anthropic()
}

export interface ChatStreamHandlers {
  send: (data: Record<string, unknown>) => void
  signal: AbortSignal
}

/** Runs the Anthropic tool loop and writes SSE payload objects via `send`. */
export async function runDemoChat(
  anthropic: Anthropic,
  messages: ChatMessage[],
  documentJson: JSONContent | undefined,
  { send, signal }: ChatStreamHandlers,
): Promise<void> {
  const tree = documentJson ? buildDocTree(documentJson) : undefined
  const convo: MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))
  const writeIntent = hasWriteIntent(latestUserText(messages))
  let rendererToolUsed = false
  let writeNudgeInjected = false

  for (let iteration = 0; iteration < DEMO_MAX_TOOL_ITERATIONS; iteration++) {
    if (signal.aborted) break

    const stream = anthropic.messages.stream(
      {
        model: DEMO_MODEL,
        max_tokens: DEMO_MAX_TOKENS,
        messages: convo,
        ...(tree ? { tools: [...DOC_TOOLS] } : {}),
      },
      { signal },
    )

    stream.on('text', (delta) => {
      send({ text: delta })
    })

    const finalMessage = await stream.finalMessage()
    if (signal.aborted) break

    convo.push({ role: 'assistant', content: finalMessage.content })

    if (finalMessage.stop_reason === 'tool_use' && tree) {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of finalMessage.content) {
        if (block.type !== 'tool_use') continue
        if (isRendererDocTool(block.name)) rendererToolUsed = true
        send({ tool: block.name, input: block.input })
        const result = executeDocTool(tree, block.name, block.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }
      convo.push({ role: 'user', content: toolResults })
      continue
    }

    // Model stopped without tools. Once per request, nudge write-intent turns to actually insert.
    const stoppedWithoutTools =
      finalMessage.stop_reason === 'end_turn' || finalMessage.stop_reason === 'max_tokens'
    if (
      stoppedWithoutTools &&
      shouldInjectWriteNudge({
        toolsAvailable: Boolean(tree),
        writeIntent,
        rendererToolUsed,
        writeNudgeInjected,
        iteration,
        maxIterations: DEMO_MAX_TOOL_ITERATIONS,
      })
    ) {
      writeNudgeInjected = true
      convo.push({ role: 'user', content: WRITE_TOOL_NUDGE })
      continue
    }

    break
  }

  if (!signal.aborted) send({ done: true })
}
