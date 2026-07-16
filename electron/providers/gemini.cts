import type { ProviderStreamFn, ToolDefinition } from './types.cjs'

const MAX_TOOL_ITERATIONS = 6

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}

function toGeminiTools(tools: ToolDefinition[]) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      })),
    },
  ]
}

export const streamGemini: ProviderStreamFn = async ({
  apiKey,
  model,
  messages,
  signal,
  onDelta,
  tools,
  executeTool,
  onToolUse,
}) => {
  if (!apiKey) throw new Error('No Gemini API key configured. Add one in Settings.')

  const geminiTools = tools?.length ? toGeminiTools(tools) : undefined
  // Gemini 2.5+ applies implicit prompt caching automatically for eligible prefixes.
  const contents: { role: string; parts: GeminiPart[] }[] = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const maxIterations = geminiTools && executeTool ? MAX_TOOL_ITERATIONS : 1

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
    const body: Record<string, unknown> = { contents }
    if (geminiTools) body.tools = geminiTools

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '')
      throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 200)}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const modelParts: GeminiPart[] = []
    const functionCalls: { name: string; args: Record<string, unknown> }[] = []

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
        try {
          const parsed = JSON.parse(payload)
          const parts: GeminiPart[] = parsed?.candidates?.[0]?.content?.parts ?? []
          for (const part of parts) {
            if (typeof part.text === 'string' && part.text) {
              onDelta(part.text)
              modelParts.push({ text: part.text })
            }
            if (part.functionCall) {
              functionCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} })
              modelParts.push({ functionCall: part.functionCall })
            }
          }
        } catch {
          // ignore malformed frame
        }
      }
    }

    if (functionCalls.length === 0 || !executeTool) return

    contents.push({ role: 'model', parts: modelParts })
    const responseParts: GeminiPart[] = []
    for (const fc of functionCalls) {
      onToolUse?.(fc.name, fc.args)
      const result = await Promise.resolve(executeTool(fc.name, fc.args))
      responseParts.push({ functionResponse: { name: fc.name, response: { result } } })
    }
    contents.push({ role: 'user', parts: responseParts })
  }
}
