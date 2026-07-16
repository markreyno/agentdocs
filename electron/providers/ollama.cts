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
    const toolCalls: OllamaToolCall[] = []

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
            onDelta(parsed.message.content as string)
            assistantContent += parsed.message.content
          }
          if (Array.isArray(parsed.message?.tool_calls)) {
            toolCalls.push(...(parsed.message.tool_calls as OllamaToolCall[]))
          }
        } catch {
          // ignore malformed line
        }
      }
    }

    if (toolCalls.length === 0 || !executeTool) return

    convo.push({ role: 'assistant', content: assistantContent, tool_calls: toolCalls })
    for (const tc of toolCalls) {
      onToolUse?.(tc.function.name, tc.function.arguments)
      const result = await Promise.resolve(executeTool(tc.function.name, tc.function.arguments ?? {}))
      convo.push({ role: 'tool', content: JSON.stringify(result) })
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
