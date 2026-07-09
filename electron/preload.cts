import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('agentdocs', {
  platform: process.platform,
})
