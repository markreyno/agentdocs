export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StreamChatHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

/** Streams a chat completion from /api/chat, parsing the server's SSE frames. */
export async function streamChat(messages: ChatMessage[], { onDelta, onDone, onError }: StreamChatHandlers) {
  let response: Response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
  } catch {
    onError('Could not reach the AI server. Is it running?')
    return
  }

  if (!response.ok || !response.body) {
    onError(`Request failed (${response.status})`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const dataLine = line.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) continue
      const payload = dataLine.slice('data: '.length)
      if (payload === '[DONE]') {
        onDone()
        return
      }
      try {
        const parsed = JSON.parse(payload)
        if (parsed.error) {
          onError(parsed.error)
        } else if (typeof parsed.text === 'string') {
          onDelta(parsed.text)
        }
      } catch {
        // ignore malformed frame
      }
    }
  }

  onDone()
}
