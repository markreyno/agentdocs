import { streamChat, type ChatMessage } from './chatClient'
import { isDesktopApp } from './isDesktop'
import { getActiveProvider, getModelFor } from './providerSettings'

interface SendChatHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

/** Routes agent chat through the desktop provider bridge when running in Electron, or the demo server on the web. */
export async function sendChatMessage(messages: ChatMessage[], handlers: SendChatHandlers) {
  if (isDesktopApp()) {
    const provider = getActiveProvider()
    const model = getModelFor(provider)
    window.agentdocs!.chat.stream(provider, model, messages, handlers)
    return
  }

  await streamChat(messages, handlers)
}
