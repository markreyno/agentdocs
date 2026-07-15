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
  /** Fired when the model calls a document search/lookup tool, for a "Searching…" style indicator. */
  onToolUse?: (name: string, input: unknown) => void
  onRateLimited?: () => void
}

function isCachableProvider(provider: string): provider is CachableProviderId {
  return provider === 'anthropic' || provider === 'openai' || provider === 'gemini'
}

/**
 * Routes agent chat through the desktop provider bridge when running in Electron, or the demo server on the web.
 * `documentJson` (the editor's Tiptap doc) is only used by the web path, which builds a doc tree server-side
 * and exposes it to the model as search/lookup tools.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  handlers: SendChatHandlers,
  documentJson?: unknown,
) {
  if (isDesktopApp()) {
    const provider = getActiveProvider()
    const model = getModelFor(provider)
    const promptCaching = isCachableProvider(provider) ? getPromptCachingEnabled(provider) : false
    window.agentdocs!.chat.stream(provider, model, messages, handlers, { promptCaching, documentJson })
    return
  }

  await streamChat(messages, handlers, documentJson)
}
