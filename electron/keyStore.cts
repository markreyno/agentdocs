import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ProviderId } from './providers/types.cjs'

const ENC_PREFIX = 'enc:'
const RAW_PREFIX = 'raw:'

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
  const filePath = storePath()
  // mode applies on create; chmod tightens perms if the file already existed as 0644.
  fs.writeFileSync(filePath, JSON.stringify(store), { encoding: 'utf-8', mode: 0o600 })
  fs.chmodSync(filePath, 0o600)
}

function encodeEncrypted(apiKey: string): string {
  return ENC_PREFIX + safeStorage.encryptString(apiKey).toString('base64')
}

function decodeEncrypted(payload: string): string | undefined {
  if (!safeStorage.isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(payload, 'base64'))
  } catch {
    return undefined
  }
}

function decodeRaw(payload: string): string {
  return Buffer.from(payload, 'base64').toString('utf-8')
}

/** Upgrade a plaintext-stored key to encrypted form when the OS keyring becomes available. */
function persistEncrypted(provider: ProviderId, apiKey: string) {
  if (!safeStorage.isEncryptionAvailable()) return
  const store = readStore()
  store[provider] = encodeEncrypted(apiKey)
  writeStore(store)
}

export function setKey(provider: ProviderId, apiKey: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Secure key storage is unavailable on this system. API keys cannot be saved in plaintext.',
    )
  }
  const store = readStore()
  store[provider] = encodeEncrypted(apiKey)
  writeStore(store)
}

export function getKey(provider: ProviderId): string | undefined {
  const store = readStore()
  const value = store[provider]
  if (!value) return undefined

  if (value.startsWith(ENC_PREFIX)) {
    return decodeEncrypted(value.slice(ENC_PREFIX.length))
  }

  if (value.startsWith(RAW_PREFIX)) {
    const apiKey = decodeRaw(value.slice(RAW_PREFIX.length))
    persistEncrypted(provider, apiKey)
    return apiKey
  }

  // Legacy entries (no prefix): try decrypt when available, else treat as raw.
  if (safeStorage.isEncryptionAvailable()) {
    const decrypted = decodeEncrypted(value)
    if (decrypted !== undefined) {
      // Rewrite with prefix so future reads don't guess.
      const next = readStore()
      next[provider] = encodeEncrypted(decrypted)
      writeStore(next)
      return decrypted
    }
  }

  const apiKey = decodeRaw(value)
  if (!apiKey) return undefined
  persistEncrypted(provider, apiKey)
  return apiKey
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
