/** Tool names the agent may dump as JSON text instead of structured tool_calls. */
const RECOVERABLE_EDIT_TOOLS = new Set(['replace_text', 'replace_story'])

export type DumpedToolCall = {
  name: string
  arguments: Record<string, unknown>
}

function asArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // ignore
    }
  }
  return {}
}

function fromObject(raw: unknown): DumpedToolCall | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  if (typeof obj.name === 'string' && RECOVERABLE_EDIT_TOOLS.has(obj.name)) {
    return {
      name: obj.name,
      arguments: asArgs(obj.arguments ?? obj.parameters ?? obj.input),
    }
  }

  if (typeof obj.tool === 'string' && RECOVERABLE_EDIT_TOOLS.has(obj.tool)) {
    const nested = obj.arguments ?? obj.parameters ?? obj.input
    if (nested !== undefined) {
      return { name: obj.tool, arguments: asArgs(nested) }
    }
    const { tool: _tool, ...rest } = obj
    return { name: obj.tool, arguments: asArgs(rest) }
  }

  if (obj.function && typeof obj.function === 'object') {
    const fn = obj.function as Record<string, unknown>
    if (typeof fn.name === 'string' && RECOVERABLE_EDIT_TOOLS.has(fn.name)) {
      return { name: fn.name, arguments: asArgs(fn.arguments) }
    }
  }

  return null
}

/**
 * Local models often print a tool call as JSON chat text. If the assistant
 * message is only that payload, recover it so we can open the inline review.
 */
export function parseDumpedToolCall(content: string): DumpedToolCall | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  const candidates: string[] = [trimmed]
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) candidates.unshift(fence[1].trim())

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const call = fromObject(item)
          if (call) return call
        }
      } else {
        const call = fromObject(parsed)
        if (call) return call
      }
    } catch {
      // try next
    }
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return fromObject(JSON.parse(trimmed.slice(start, end + 1)) as unknown)
    } catch {
      return null
    }
  }

  return null
}
