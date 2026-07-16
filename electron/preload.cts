import { contextBridge, ipcRenderer } from 'electron'
import type { ChatMessage, ProviderDescriptor, ProviderId } from './providers/types.cjs'

declare const crypto: { randomUUID: () => string }

type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  | { type: 'done' }
  | { type: 'error'; message: string }

interface ChatStreamHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
  /** Fired when the model calls a document tool, for a status indicator. */
  onToolUse?: (name: string, input: unknown) => void
}

type RendererToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>

function streamChat(
  provider: ProviderId,
  model: string,
  messages: ChatMessage[],
  handlers: ChatStreamHandlers,
  options?: {
    promptCaching?: boolean
    documentJson?: unknown
    executeRendererTool?: RendererToolExecutor
  },
): () => void {
  const requestId = crypto.randomUUID()
  const channel = `chat:event:${requestId}`
  const rendererToolChannel = `chat:renderer-tool:${requestId}`

  const rendererToolListener = async (
    _event: unknown,
    payload: { toolCallId: string; name: string; input: Record<string, unknown> },
  ) => {
    try {
      const result = options?.executeRendererTool
        ? await options.executeRendererTool(payload.name, payload.input)
        : { error: 'No renderer tool handler registered' }
      await ipcRenderer.invoke('chat:renderer-tool-result', {
        requestId,
        toolCallId: payload.toolCallId,
        result,
      })
    } catch (err) {
      await ipcRenderer.invoke('chat:renderer-tool-result', {
        requestId,
        toolCallId: payload.toolCallId,
        error: err instanceof Error ? err.message : 'Renderer tool failed',
      })
    }
  }

  const listener = (_event: unknown, payload: ChatEvent) => {
    if (payload.type === 'delta') {
      handlers.onDelta(payload.text)
      return
    }
    if (payload.type === 'tool') {
      handlers.onToolUse?.(payload.name, payload.input)
      return
    }
    ipcRenderer.removeListener(channel, listener)
    ipcRenderer.removeListener(rendererToolChannel, rendererToolListener)
    if (payload.type === 'done') {
      handlers.onDone()
    } else {
      handlers.onError(payload.message)
    }
  }

  ipcRenderer.on(channel, listener)
  ipcRenderer.on(rendererToolChannel, rendererToolListener)
  ipcRenderer.send('chat:start', {
    requestId,
    provider,
    model,
    messages,
    promptCaching: options?.promptCaching,
    documentJson: options?.documentJson,
  })

  return () => {
    ipcRenderer.removeListener(channel, listener)
    ipcRenderer.removeListener(rendererToolChannel, rendererToolListener)
    ipcRenderer.send('chat:cancel', requestId)
  }
}

contextBridge.exposeInMainWorld('agentdocs', {
  platform: process.platform,
  providers: {
    list: (): Promise<ProviderDescriptor[]> => ipcRenderer.invoke('providers:list'),
  },
  keys: {
    status: (): Promise<Record<ProviderId, boolean>> => ipcRenderer.invoke('keys:status'),
    set: (provider: ProviderId, apiKey: string): Promise<void> => ipcRenderer.invoke('keys:set', provider, apiKey),
    delete: (provider: ProviderId): Promise<void> => ipcRenderer.invoke('keys:delete', provider),
  },
  ollama: {
    ensureRunning: (): Promise<{ started: boolean; available: boolean }> =>
      ipcRenderer.invoke('ollama:ensure'),
    models: (): Promise<string[]> => ipcRenderer.invoke('ollama:models'),
  },
  chat: {
    stream: streamChat,
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  },
})
