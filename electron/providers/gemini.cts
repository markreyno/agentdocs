import type { ProviderStreamFn } from './types.cjs'

export const streamGemini: ProviderStreamFn = async ({ apiKey, model, messages, signal, onDelta }) => {
  if (!apiKey) throw new Error('No Gemini API key configured. Add one in Settings.')

  // Gemini 2.5+ applies implicit prompt caching automatically for eligible prefixes.
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
    signal,
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

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
        const text = (parsed?.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p.text ?? '')
          .join('')
        if (text) onDelta(text)
      } catch {
        // ignore malformed frame
      }
    }
  }
}
