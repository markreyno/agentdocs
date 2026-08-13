/** Shared helpers: detect write intent and nudge models that talk instead of calling edit tools. */

export const WRITE_INTENT_RE =
  /\b(create|write|draft|generate|compose|insert|add a|make me|make a|make an)\b/i

export const WRITE_TOOL_NUDGE =
  'You did not call any edit tools. If the user asked you to create or write manuscript content, you MUST call get_story_blocks then insert_blocks now with a short story (one heading and a few paragraphs; after_index: -1 for an empty doc). Do not only describe what you will write.'

export function latestUserText(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return ''
}

export function hasWriteIntent(text: string): boolean {
  return WRITE_INTENT_RE.test(text)
}

export function shouldInjectWriteNudge(opts: {
  toolsAvailable: boolean
  writeIntent: boolean
  rendererToolUsed: boolean
  writeNudgeInjected: boolean
  iteration: number
  maxIterations: number
}): boolean {
  return (
    opts.toolsAvailable &&
    opts.writeIntent &&
    !opts.rendererToolUsed &&
    !opts.writeNudgeInjected &&
    opts.iteration < opts.maxIterations - 1
  )
}
