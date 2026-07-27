import { searchSentences, type DocNode } from './docTree'

export interface ReplaceTextInput {
  find?: string
  replace: string
  /** When true, replace every match. Single-token finds default to all matches. */
  replace_all?: boolean
}

export type ReplaceHunk = {
  from: number
  to: number
  matchedText: string
  replace: string
}

export type ReplaceTextResult =
  | {
      status: 'proposed'
      from: number
      to: number
      matchedText: string
      replace: string
      hunks: ReplaceHunk[]
      message: string
    }
  | { status: 'not_found'; message: string }
  | { status: 'error'; message: string }

export const RENDERER_DOC_TOOLS = ['replace_text', 'replace_story', 'insert_blocks'] as const
export type RendererDocToolName = (typeof RENDERER_DOC_TOOLS)[number]

export function isRendererDocTool(name: string): name is RendererDocToolName {
  return (RENDERER_DOC_TOOLS as readonly string[]).includes(name)
}

function truncate(s: string, max = 80): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

/** Heuristic: capitalized multi-word phrases that look like chapter titles. */
export function isLikelyTitlePhrase(text: string): boolean {
  const t = text.trim()
  if (t.length < 4 || t.length > 100) return false
  if (/\w['\u2019]s\b/.test(t) || /^the\s+/i.test(t)) return true
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 12 || !/^[A-Z0-9"']/.test(t)) return false
  // Require title case on most content words so body phrases like "Blueberry jam"
  // are not mistaken for chapter headings.
  const contentWords = words.filter((w) => !/^(a|an|the|of|at|in|on|to|for|and|or)$/i.test(w))
  if (contentWords.length === 0) return false
  const capitalized = contentWords.filter((w) => /^[A-Z0-9"']/.test(w))
  return capitalized.length >= Math.ceil(contentWords.length * 0.6)
}

export function wantsReplaceAll(
  find: string,
  matchCount: number,
  replace: string,
  replaceAll?: boolean,
): boolean {
  if (replaceAll === true) return true
  if (replaceAll === false) return false
  if (matchCount <= 1) return false
  if (/^\S+$/.test(find)) return true
  return replace.trim().length > find.length + 12
}

/** Tree-only fallback when no live editor is available (web server / electron main tool loop). */
export function proposeReplaceInTree(tree: DocNode, input: ReplaceTextInput): ReplaceTextResult {
  const replace = String(input.replace ?? '')
  if (!replace) return { status: 'error', message: 'replace is required' }

  const find = String(input.find ?? '').trim()
  if (!find) {
    return {
      status: 'error',
      message:
        'find is required when no editor selection is active. ' +
        'For a rename, call replace_text with find, replace, and replace_all: true ' +
        '(example: find "Boby", replace "Toby", replace_all true).',
    }
  }

  if (isLikelyTitlePhrase(find)) {
    return {
      status: 'error',
      message:
        `find looks like a chapter heading ("${truncate(find)}"). Use get_story_blocks and replace_story instead of replace_text.`,
    }
  }

  const hits = searchSentences(tree, find)
  if (hits.length === 0) {
    return { status: 'not_found', message: `Could not find passage matching: "${truncate(find)}"` }
  }

  const useAll = wantsReplaceAll(find, hits.length, replace, input.replace_all)
  const selected = useAll ? hits : [hits[0]!]
  const hunks = selected.map((hit) => ({
    from: hit.pos.from,
    to: hit.pos.to,
    matchedText: hit.text,
    replace,
  }))
  const first = hunks[0]!

  return {
    status: 'proposed',
    from: first.from,
    to: first.to,
    matchedText: first.matchedText,
    replace,
    hunks,
    message:
      hunks.length > 1
        ? `Matched ${hunks.length} passages; proposed replacements for all. Author must accept in editor.`
        : 'Edit proposed for author review in the editor.',
  }
}
