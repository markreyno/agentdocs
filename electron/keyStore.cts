import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ProviderId } from './providers/types.cjs'

function storePath(): string {
  return path.join(app.getPath('userData'), 'provider-keys.json')
}

function readStore(): Record<string, string> {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8')
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, string>) {
  fs.writeFileSync(storePath(), JSON.stringify(store), 'utf-8')
}

export function setKey(provider: ProviderId, apiKey: string) {
  const store = readStore()
  if (safeStorage.isEncryptionAvailable()) {
    store[provider] = safeStorage.encryptString(apiKey).toString('base64')
  } else {
    store[provider] = Buffer.from(apiKey, 'utf-8').toString('base64')
  }
  writeStore(store)
}

export function getKey(provider: ProviderId): string | undefined {
  const store = readStore()
  const value = store[provider]
  if (!value) return undefined

  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(value, 'base64'))
    } catch {
      return undefined
    }
  }
  return Buffer.from(value, 'base64').toString('utf-8')
}

export function hasKey(provider: ProviderId): boolean {
  return Boolean(readStore()[provider])
}

export function deleteKey(provider: ProviderId) {
  const store = readStore()
  delete store[provider]
  writeStore(store)
}

export function listKeyStatus(): Record<ProviderId, boolean> {
  const store = readStore()
  return {
    anthropic: Boolean(store.anthropic),
    openai: Boolean(store.openai),
    gemini: Boolean(store.gemini),
    ollama: true,
  }
}
