import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const OLLAMA_BASE_URL = 'http://localhost:11434'

const HEALTH_CHECK_TIMEOUT_MS = 2000
const STARTUP_POLL_INTERVAL_MS = 300
const STARTUP_TIMEOUT_MS = 30_000

let spawnedProcess: ChildProcess | null = null

async function isOllamaRunning(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}

function getOllamaCandidates(): string[] {
  const candidates: string[] = []

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      candidates.push(path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'))
    }
    candidates.push('ollama')
    return candidates
  }

  if (process.platform === 'darwin') {
    candidates.push('/Applications/Ollama.app/Contents/Resources/ollama')
    candidates.push('/usr/local/bin/ollama')
    candidates.push('ollama')
    return candidates
  }

  candidates.push('/usr/bin/ollama')
  candidates.push('/usr/local/bin/ollama')
  candidates.push('ollama')
  return candidates
}

function resolveOllamaExecutable(): string | null {
  for (const candidate of getOllamaCandidates()) {
    if (candidate === 'ollama') return candidate
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function spawnOllama(executable: string): ChildProcess {
  const useShell = executable === 'ollama'
  return spawn(executable, ['serve'], {
    detached: false,
    stdio: 'ignore',
    windowsHide: true,
    shell: useShell,
    env: process.env,
  })
}

async function waitForOllama(): Promise<boolean> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isOllamaRunning()) return true
    await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL_MS))
  }
  return false
}

/** Starts Ollama if it is installed but not already listening on localhost:11434. */
export async function ensureOllamaRunning(): Promise<{ started: boolean; available: boolean }> {
  if (await isOllamaRunning()) {
    return { started: false, available: true }
  }

  const executable = resolveOllamaExecutable()
  if (!executable) {
    return { started: false, available: false }
  }

  try {
    spawnedProcess = spawnOllama(executable)
    spawnedProcess.on('exit', () => {
      spawnedProcess = null
    })
  } catch {
    return { started: false, available: false }
  }

  const available = await waitForOllama()
  if (!available && spawnedProcess && !spawnedProcess.killed) {
    spawnedProcess.kill()
    spawnedProcess = null
  }

  return { started: available, available }
}

/** Stops Ollama only if this app started it during the current session. */
export function stopOllamaIfSpawned() {
  if (spawnedProcess && !spawnedProcess.killed) {
    spawnedProcess.kill()
    spawnedProcess = null
  }
}
