export {}

declare global {
  interface Window {
    agentdocs?: {
      platform: NodeJS.Platform
    }
  }
}
