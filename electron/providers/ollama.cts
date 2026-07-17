import { OLLAMA_BASE_URL } from '../ollamaService.cjs'
import type { ProviderStreamFn, ToolDefinition } from './types.cjs'

const MAX_TOOL_ITERATIONS = 6

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> }
}

function toOllamaTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }))
}

function normalizeToolArgs(args: unknown): Record<string, unknown> {
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>
  }
  if (typeof args === 'string' && args.trim()) {
    try {
      const parsed = JSON.parse(args) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // model sometimes returns non-JSON argument strings
    }
  }
  return {}
}

function normalizeToolCall(raw: unknown): OllamaToolCall | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const fn = (
    obj.function && typeof obj.function === 'object' ? obj.function : obj
  ) as Record<string, unknown>
  const name = typeof fn.name === 'string' ? fn.name : ''
  if (!name) return null
  return { function: { name, arguments: normalizeToolArgs(fn.arguments) } }
}

function toolCallFromObject(
  raw: unknown,
  knownNames: Set<string>,
): OllamaToolCall | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  // {"name":"replace_text","arguments":{...}}
  if (typeof obj.name === 'string' && knownNames.has(obj.name)) {
    return {
      function: {
        name: obj.name,
        arguments: normalizeToolArgs(obj.arguments ?? obj.parameters ?? obj.input),
      },
    }
  }

  // {"tool":"replace_text","find":"...","replace":"..."}
  if (typeof obj.tool === 'string' && knownNames.has(obj.tool)) {
    const args = obj.arguments ?? obj.parameters ?? obj.input
    if (args !== undefined) {
      return { function: { name: obj.tool, arguments: normalizeToolArgs(args) } }
    }
    const { tool: _tool, ...rest } = obj
    return { function: { name: obj.tool, arguments: normalizeToolArgs(rest) } }
  }

  const nested = normalizeToolCall(obj)
  if (nested && knownNames.has(nested.function.name)) return nested
  return null
}

/**
 * Weaker local models often print a tool call as JSON text instead of using
 * Ollama's structured tool_calls field. Recover those so edits still run.
 */
function extractToolCallsFromContent(
  content: string,
  knownNames: Set<string>,
): OllamaToolCall[] {
  const trimmed = content.trim()
  if (!trimmed || knownNames.size === 0) return []

  const candidates: string[] = [trimmed]
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) candidates.push(fence[1].trim())

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (Array.isArray(parsed)) {
        const calls = parsed
          .map((item) => toolCallFromObject(item, knownNames))
          .filter((tc): tc is OllamaToolCall => tc !== null)
        if (calls.length) return calls
      } else {
        const call = toolCallFromObject(parsed, knownNames)
        if (call) return [call]
      }
    } catch {
      // try next candidate
    }
  }

  // Last resort: first {...} object in the text
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const call = toolCallFromObject(
        JSON.parse(trimmed.slice(start, end + 1)) as unknown,
        knownNames,
      )
      if (call) return [call]
    } catch {
      // ignore
    }
  }

  return []
}

export const streamOllama: ProviderStreamFn = async ({
  model,
  messages,
  signal,
  onDelta,
  tools,
  executeTool,
  onToolUse,
}) => {
  const ollamaTools = tools?.length ? toOllamaTools(tools) : undefined
  const knownToolNames = new Set((tools ?? []).map((t) => t.name))
  const convo: Record<string, unknown>[] = messages.map((m) => ({ role: m.role, content: m.content }))
  const maxIterations = ollamaTools && executeTool ? MAX_TOOL_ITERATIONS : 1

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let response: Response
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: convo,
          stream: true,
          ...(ollamaTools ? { tools: ollamaTools } : {}),
        }),
        signal,
      })
    } catch {
      throw new Error('Could not reach Ollama. Is it running locally on port 11434?')
    }

    if (!response.ok || !response.body) {
      throw new Error(`Ollama request failed (${response.status}). Is "${model}" pulled locally? ` +
        'Tool calling requires a model that supports it (e.g. llama3.1+).')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let assistantContent = ''
    // Replace (do not append) when a chunk includes tool_calls — Ollama may resend
    // the full list on later chunks, and pushing would duplicate executions.
    let toolCalls: OllamaToolCall[] = []
    // Buffer text while tools are enabled so a JSON tool dump is not shown as chat.
    const bufferTextForTools = Boolean(ollamaTools && executeTool)

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
          if (parsed.message?.content) {
            const text = parsed.message.content as string
            assistantContent += text
            if (!bufferTextForTools) onDelta(text)
          }
          if (Array.isArray(parsed.message?.tool_calls) && parsed.message.tool_calls.length > 0) {
            toolCalls = parsed.message.tool_calls
              .map(normalizeToolCall)
              .filter((tc: OllamaToolCall | null): tc is OllamaToolCall => tc !== null)
              .filter((tc) => knownToolNames.has(tc.function.name))
          }
        } catch {
          // ignore malformed line
        }
      }
    }

    let recoveredFromText = false
    if (toolCalls.length === 0 && bufferTextForTools) {
      toolCalls = extractToolCallsFromContent(assistantContent, knownToolNames)
      recoveredFromText = toolCalls.length > 0
    }

    if (toolCalls.length === 0 || !executeTool) {
      if (bufferTextForTools && assistantContent) onDelta(assistantContent)
      return
    }

    // Keep history clean when the model only dumped JSON as text.
    convo.push({
      role: 'assistant',
      content: recoveredFromText ? '' : assistantContent,
      tool_calls: toolCalls,
    })
    for (const tc of toolCalls) {
      const args = tc.function.arguments
      onToolUse?.(tc.function.name, args)
      const result = await Promise.resolve(executeTool(tc.function.name, args))
      convo.push({
        role: 'tool',
        tool_name: tc.function.name,
        content: JSON.stringify(result),
      })
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
