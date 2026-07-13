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
}

function isCachableProvider(provider: string): provider is CachableProviderId {
  return provider === 'anthropic' || provider === 'openai' || provider === 'gemini'
}

/** Routes agent chat through the desktop provider bridge when running in Electron, or the demo server on the web. */
export async function sendChatMessage(messages: ChatMessage[], handlers: SendChatHandlers) {
  if (isDesktopApp()) {
    const provider = getActiveProvider()
    const model = getModelFor(provider)
    const promptCaching = isCachableProvider(provider) ? getPromptCachingEnabled(provider) : false
    window.agentdocs!.chat.stream(provider, model, messages, handlers, { promptCaching })
    return
  }

  await streamChat(messages, handlers)
}
