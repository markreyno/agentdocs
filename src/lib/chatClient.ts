import { clearDemoSession, ensureDemoSessionToken } from './demoSession'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StreamChatHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
  /** Fired when the model calls a document tool, for a status indicator. */
  onToolUse?: (name: string, input: unknown) => void
  onRateLimited?: () => void
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return body.error
  } catch {
    // use fallback
  }
  return fallback
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError'
}

/** Streams a chat completion from /api/chat, parsing the server's SSE frames. */
export async function streamChat(
  messages: ChatMessage[],
  { onDelta, onDone, onError, onToolUse, onRateLimited }: StreamChatHandlers,
  documentJson?: unknown,
  signal?: AbortSignal,
) {
  if (signal?.aborted) return

  let token = await ensureDemoSessionToken()
  if (!token) {
    onError('Could not start a demo session. Is the API server running?')
    return
  }

  const postChat = (bearer: string) =>
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ messages, documentJson }),
      signal,
    })

  let response: Response
  try {
    response = await postChat(token)
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) return
    onError('Could not reach the AI server. Is it running?')
    return
  }

  // Session may have expired server-side; mint once and retry.
  if (response.status === 401) {
    clearDemoSession()
    token = await ensureDemoSessionToken()
    if (!token) {
      onError(await readErrorMessage(response, 'Demo session expired.'))
      return
    }
    try {
      response = await postChat(token)
    } catch (err) {
      if (isAbortError(err) || signal?.aborted) return
      onError('Could not reach the AI server. Is it running?')
      return
    }
  }

  if (signal?.aborted) return

  if (response.status === 429) {
    onRateLimited?.()
    onError(
      await readErrorMessage(
        response,
        'Demo limit reached. Download the desktop app for unlimited access.',
      ),
    )
    return
  }

  if (response.status === 403) {
    onError(await readErrorMessage(response, 'This origin is not allowed to use demo chat.'))
    return
  }

  if (response.status === 401 || response.status === 503) {
    onError(
      await readErrorMessage(
        response,
        response.status === 503
          ? 'Demo chat is disabled on the server.'
          : 'Demo session authorization failed.',
      ),
    )
    return
  }

  if (!response.ok || !response.body) {
    onError(`Request failed (${response.status})`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel()
        return
      }
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
          if (!signal?.aborted) onDone()
          return
        }
        try {
          const parsed = JSON.parse(payload)
          if (signal?.aborted) return
          if (parsed.error) {
            onError(parsed.error)
          } else if (typeof parsed.text === 'string') {
            onDelta(parsed.text)
          } else if (typeof parsed.tool === 'string') {
            onToolUse?.(parsed.tool, parsed.input)
          }
        } catch {
          // ignore malformed frame
        }
      }
    }

    if (!signal?.aborted) onDone()
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) return
    throw err
  }
}
