import type { ProviderStreamFn, ToolDefinition } from './types.cjs'

const MAX_TOOL_ITERATIONS = 6

interface ToolCallAccumulator {
  id?: string
  name?: string
  args: string
}

function toOpenAiTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }))
}

export const streamOpenAI: ProviderStreamFn = async ({
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
  if (!apiKey) throw new Error('No OpenAI API key configured. Add one in Settings.')

  const openAiTools = tools?.length ? toOpenAiTools(tools) : undefined
  const convo: Record<string, unknown>[] = messages.map((m) => ({ role: m.role, content: m.content }))
  const maxIterations = openAiTools && executeTool ? MAX_TOOL_ITERATIONS : 1

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // OpenAI caches eligible prompts automatically. prompt_cache_key improves routing/hit rates
    // for shared prefixes; older models ignore unknown fields if rejected we fall back without it.
    const body: Record<string, unknown> = { model, messages: convo, stream: true }
    if (promptCaching) body.prompt_cache_key = 'agentdocs'
    if (openAiTools) body.tools = openAiTools

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '')
      throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 200)}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finishReason: string | undefined
    const toolCallAcc = new Map<number, ToolCallAccumulator>()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''

      for (const chunk of chunks) {
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '))
        if (!dataLine) continue
        const payload = dataLine.slice('data: '.length)
        if (payload === '[DONE]') continue
        try {
          const parsed = JSON.parse(payload)
          const choice = parsed?.choices?.[0]
          const delta = choice?.delta
          const text = delta?.content
          if (typeof text === 'string' && text) onDelta(text)

          if (Array.isArray(delta?.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = typeof tc.index === 'number' ? tc.index : 0
              const acc = toolCallAcc.get(idx) ?? { args: '' }
              if (tc.id) acc.id = tc.id
              if (tc.function?.name) acc.name = tc.function.name
              if (tc.function?.arguments) acc.args += tc.function.arguments
              toolCallAcc.set(idx, acc)
            }
          }
          if (choice?.finish_reason) finishReason = choice.finish_reason
        } catch {
          // ignore malformed frame
        }
      }
    }

    if (finishReason !== 'tool_calls' || !executeTool || toolCallAcc.size === 0) return

    const toolCalls = [...toolCallAcc.values()]
    convo.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls.map((tc, i) => ({
        id: tc.id ?? `call_${i}`,
        type: 'function',
        function: { name: tc.name ?? '', arguments: tc.args },
      })),
    })
    for (const tc of toolCalls) {
      let input: Record<string, unknown> = {}
      try {
        input = tc.args ? JSON.parse(tc.args) : {}
      } catch {
        // malformed args from the model; execute with an empty input rather than failing the turn
      }
      onToolUse?.(tc.name ?? '', input)
      const result = await Promise.resolve(executeTool(tc.name ?? '', input))
      convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
    }
  }
}
