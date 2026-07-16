import { streamChat, type ChatMessage } from './chatClient'
import { isDesktopApp } from './isDesktop'
import {
  getActiveProvider,
  getModelFor,
  getPromptCachingEnabled,
  type CachableProviderId,
} from './providerSettings'

interface SendChatHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
  /** Fired when the model calls a document tool, for a status indicator. */
  onToolUse?: (name: string, input: unknown) => void
  onRateLimited?: () => void
}

export interface SendChatOptions {
  /** Executes tools that need the live editor (e.g. replace_text) in the desktop app. */
  executeRendererTool?: (name: string, input: Record<string, unknown>) => Promise<unknown>
}

function isCachableProvider(provider: string): provider is CachableProviderId {
  return provider === 'anthropic' || provider === 'openai' || provider === 'gemini'
}

/**
 * Routes agent chat through the desktop provider bridge when running in Electron, or the demo server on the web.
 * `documentJson` builds a doc tree server-side and exposes search/edit tools to the model.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  handlers: SendChatHandlers,
  documentJson?: unknown,
  options?: SendChatOptions,
) {
  if (isDesktopApp()) {
    const provider = getActiveProvider()
    const model = getModelFor(provider)
    const promptCaching = isCachableProvider(provider) ? getPromptCachingEnabled(provider) : false
    window.agentdocs!.chat.stream(provider, model, messages, handlers, {
      promptCaching,
      documentJson,
      executeRendererTool: options?.executeRendererTool,
    })
    return
  }

  await streamChat(messages, handlers, documentJson)
}
