import type { ChatMessage } from './lib/chatClient'
import type { ProviderDescriptor, ProviderId } from './lib/providers'

export {}

interface ChatStreamHandlers {
  onDelta: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
  /** Fired when the model calls a document tool, for a status indicator. */
  onToolUse?: (name: string, input: unknown) => void
}

type RendererToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>

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
          options?: {
            promptCaching?: boolean
            documentJson?: unknown
            executeRendererTool?: RendererToolExecutor
          },
        ) => () => void
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
    }
  }
}
