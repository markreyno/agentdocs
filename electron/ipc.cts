import { ipcMain, type IpcMainEvent } from 'electron'
import { deleteKey, getKey, listKeyStatus, setKey } from './keyStore.cjs'
import { getStreamFn, listOllamaModels, PROVIDERS } from './providers/index.cjs'
import type { ChatMessage, ProviderId } from './providers/types.cjs'

interface ChatStartPayload {
  requestId: string
  provider: ProviderId
  model: string
  messages: ChatMessage[]
}

type ChatEvent = { type: 'delta'; text: string } | { type: 'done' } | { type: 'error'; message: string }

const activeRequests = new Map<string, AbortController>()

function sendChatEvent(event: IpcMainEvent, requestId: string, payload: ChatEvent) {
  event.sender.send(`chat:event:${requestId}`, payload)
}

export function registerIpcHandlers() {
  ipcMain.on('chat:start', async (event, { requestId, provider, model, messages }: ChatStartPayload) => {
    const controller = new AbortController()
    activeRequests.set(requestId, controller)

    try {
      const apiKey = getKey(provider)
      const stream = getStreamFn(provider)
      await stream({
        apiKey,
        model,
        messages,
        signal: controller.signal,
        onDelta: (text) => sendChatEvent(event, requestId, { type: 'delta', text }),
      })
      sendChatEvent(event, requestId, { type: 'done' })
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Unknown error contacting the model.'
        sendChatEvent(event, requestId, { type: 'error', message })
      }
    } finally {
      activeRequests.delete(requestId)
    }
  })

  ipcMain.on('chat:cancel', (_event, requestId: string) => {
    activeRequests.get(requestId)?.abort()
    activeRequests.delete(requestId)
  })

  ipcMain.handle('providers:list', () => PROVIDERS)

  ipcMain.handle('keys:status', () => listKeyStatus())

  ipcMain.handle('keys:set', (_event, provider: ProviderId, apiKey: string) => {
    setKey(provider, apiKey)
  })

  ipcMain.handle('keys:delete', (_event, provider: ProviderId) => {
    deleteKey(provider)
  })

  ipcMain.handle('ollama:models', () => listOllamaModels())
}
