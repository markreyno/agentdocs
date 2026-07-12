import { contextBridge, ipcRenderer } from 'electron'
import type { ChatMessage, ProviderDescriptor, ProviderId } from './providers/types.cjs'

declare const crypto: { randomUUID: () => string }

type ChatEvent = { type: 'delta'; text: string } | { type: 'done' } | { type: 'error'; message: string }

interface ChatStreamHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

function streamChat(
  provider: ProviderId,
  model: string,
  messages: ChatMessage[],
  handlers: ChatStreamHandlers,
): () => void {
  const requestId = crypto.randomUUID()
  const channel = `chat:event:${requestId}`

  const listener = (_event: unknown, payload: ChatEvent) => {
    if (payload.type === 'delta') {
      handlers.onDelta(payload.text)
      return
    }
    ipcRenderer.removeListener(channel, listener)
    if (payload.type === 'done') {
      handlers.onDone()
    } else {
      handlers.onError(payload.message)
    }
  }

  ipcRenderer.on(channel, listener)
  ipcRenderer.send('chat:start', { requestId, provider, model, messages })

  return () => {
    ipcRenderer.removeListener(channel, listener)
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
