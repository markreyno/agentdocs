import type { ChatMessage } from './lib/chatClient'
import type { ProviderDescriptor, ProviderId } from './lib/providers'

export {}

interface ChatStreamHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

declare global {
  interface Window {
    agentdocs?: {
      platform: NodeJS.Platform
      providers: {
        list: () => Promise<ProviderDescriptor[]>
      }
      keys: {
        status: () => Promise<Record<ProviderId, boolean>>
        set: (provider: ProviderId, apiKey: string) => Promise<void>
        delete: (provider: ProviderId) => Promise<void>
      }
      ollama: {
        ensureRunning: () => Promise<{ started: boolean; available: boolean }>
        models: () => Promise<string[]>
      }
      chat: {
        stream: (
          provider: ProviderId,
          model: string,
          messages: ChatMessage[],
          handlers: ChatStreamHandlers,
          options?: { promptCaching?: boolean },
        ) => () => void
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
    }
  }
}
