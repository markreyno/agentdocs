import { ipcMain, shell, type IpcMainEvent } from 'electron'
import type { JSONContent } from '@tiptap/core'
import { buildDocTree } from './docTree.cjs'
import { DOC_TOOLS, executeDocTool } from './docTools.cjs'
import { deleteKey, getKey, listKeyStatus, setKey } from './keyStore.cjs'
import { ensureOllamaRunning } from './ollamaService.cjs'
import { getStreamFn, listOllamaModels, PROVIDERS } from './providers/index.cjs'
import type { ChatMessage, ProviderId, ToolDefinition } from './providers/types.cjs'

interface ChatStartPayload {
  requestId: string
  provider: ProviderId
  model: string
  messages: ChatMessage[]
  promptCaching?: boolean
  documentJson?: JSONContent
}

type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  | { type: 'done' }
  | { type: 'error'; message: string }

const activeRequests = new Map<string, AbortController>()

function sendChatEvent(event: IpcMainEvent, requestId: string, payload: ChatEvent) {
  event.sender.send(`chat:event:${requestId}`, payload)
}

export function registerIpcHandlers() {
  ipcMain.on(
    'chat:start',
    async (event, { requestId, provider, model, messages, promptCaching, documentJson }: ChatStartPayload) => {
    const controller = new AbortController()
    activeRequests.set(requestId, controller)

    try {
      if (provider === 'ollama') {
        const { available } = await ensureOllamaRunning()
        if (!available) {
          sendChatEvent(event, requestId, {
            type: 'error',
            message: 'Could not reach Ollama. Is it installed and available locally?',
          })
          return
        }
      }

      const tree = documentJson ? buildDocTree(documentJson) : undefined
      const apiKey = getKey(provider)
      const stream = getStreamFn(provider)
      await stream({
        apiKey,
        model,
        messages,
        promptCaching: Boolean(promptCaching),
        signal: controller.signal,
        onDelta: (text) => sendChatEvent(event, requestId, { type: 'delta', text }),
        ...(tree
          ? {
              tools: DOC_TOOLS as unknown as ToolDefinition[],
              executeTool: (name: string, input: Record<string, unknown>) => executeDocTool(tree, name, input),
              onToolUse: (name: string, input: unknown) => sendChatEvent(event, requestId, { type: 'tool', name, input }),
            }
          : {}),
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
  },
  )

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

  ipcMain.handle('ollama:ensure', () => ensureOllamaRunning())

  ipcMain.handle('ollama:models', () => listOllamaModels())

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('Invalid URL')
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http(s) URLs are allowed')
    }
    await shell.openExternal(parsed.toString())
  })
}
