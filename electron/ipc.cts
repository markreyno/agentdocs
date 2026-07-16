import { ipcMain, shell, type IpcMainEvent } from 'electron'
import type { JSONContent } from '@tiptap/core'
import { buildDocTree } from './docTree.cjs'
import { DOC_TOOLS, executeDocTool, isRendererDocTool } from './docTools.cjs'
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
const pendingRendererTools = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
>()

let rendererToolSeq = 0

function sendChatEvent(event: IpcMainEvent, requestId: string, payload: ChatEvent) {
  event.sender.send(`chat:event:${requestId}`, payload)
}

function rejectPendingRendererTools(requestId: string, message: string) {
  for (const [key, pending] of pendingRendererTools) {
    if (!key.startsWith(`${requestId}:`)) continue
    clearTimeout(pending.timeout)
    pendingRendererTools.delete(key)
    pending.reject(new Error(message))
  }
}

function requestRendererTool(
  event: IpcMainEvent,
  requestId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const toolCallId = String(++rendererToolSeq)
  const key = `${requestId}:${toolCallId}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRendererTools.delete(key)
      reject(new Error(`Renderer tool "${name}" timed out`))
    }, 30_000)

    pendingRendererTools.set(key, {
      resolve: (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      reject: (error) => {
        clearTimeout(timeout)
        reject(error)
      },
      timeout,
    })

    event.sender.send(`chat:renderer-tool:${requestId}`, { toolCallId, name, input })
  })
}

export function registerIpcHandlers() {
  ipcMain.handle(
    'chat:renderer-tool-result',
    (
      _event,
      {
        requestId,
        toolCallId,
        result,
        error,
      }: { requestId: string; toolCallId: string; result?: unknown; error?: string },
    ) => {
      const key = `${requestId}:${toolCallId}`
      const pending = pendingRendererTools.get(key)
      if (!pending) return
      pendingRendererTools.delete(key)
      clearTimeout(pending.timeout)
      if (error) pending.reject(new Error(error))
      else pending.resolve(result)
    },
  )

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
              executeTool: async (name: string, input: Record<string, unknown>) => {
                if (isRendererDocTool(name)) {
                  return requestRendererTool(event, requestId, name, input)
                }
                return executeDocTool(tree, name, input)
              },
              onToolUse: (name: string, input: unknown) =>
                sendChatEvent(event, requestId, { type: 'tool', name, input }),
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
      rejectPendingRendererTools(requestId, 'Chat request ended')
      activeRequests.delete(requestId)
    }
  },
  )

  ipcMain.on('chat:cancel', (_event, requestId: string) => {
    rejectPendingRendererTools(requestId, 'Chat request cancelled')
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
