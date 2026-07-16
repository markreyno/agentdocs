import type { Editor } from '@tiptap/react'
import {
  expandRangeToSentence,
  isLikelyTitlePhrase,
  locateAllSentencesContaining,
  locateAllTextInDoc,
  locateTextInDoc,
  mergeOverlappingRanges,
  rangesOverlap,
  type DocRange,
} from './textLocate'
import { searchSentences, type DocNode } from './docTree'
import { getActiveReview } from '../extensions/InlineReview'
import {
  applyReplaceStoryInEditor,
  type ReplaceStoryInput,
} from './storyEdit'

export interface ReplaceTextInput {
  find?: string
  replace: string
  /** When true, replace every match. Single-token finds default to all matches. */
  replace_all?: boolean
}

export interface SelectionRange {
  from: number
  to: number
  text: string
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

export const RENDERER_DOC_TOOLS = ['replace_text', 'replace_story'] as const
export type RendererDocToolName = (typeof RENDERER_DOC_TOOLS)[number]

export function isRendererDocTool(name: string): name is RendererDocToolName {
  return (RENDERER_DOC_TOOLS as readonly string[]).includes(name)
}

function wantsReplaceAll(
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

function shouldExpandWordMatchToSentence(find: string, replace: string, useAll: boolean): boolean {
  if (!useAll || !/^\S+$/.test(find)) return false
  return replace.trim().length > find.length + 12
}

function buildHunksFromRanges(ranges: DocRange[], replace: string): ReplaceHunk[] {
  return ranges.map((range) => ({
    from: range.from,
    to: range.to,
    matchedText: range.text,
    replace,
  }))
}

function resolveFindRanges(
  doc: Parameters<typeof locateAllSentencesContaining>[0],
  find: string,
  replace: string,
  replaceAll?: boolean,
): { ranges: DocRange[]; useAll: boolean; error?: string } {
  if (isLikelyTitlePhrase(find)) {
    return {
      ranges: [],
      useAll: false,
      error:
        `find looks like a chapter heading ("${truncate(find)}"). replace_text cannot rename headings. ` +
        'Call get_story_blocks, then replace_story with { index, replace } for the heading and paragraphs together in one pass.',
    }
  }

  const sentenceMatches = locateAllSentencesContaining(doc, find)
  if (sentenceMatches.length > 0) {
    const useAll = wantsReplaceAll(find, sentenceMatches.length, replace, replaceAll)
    // A plain single-token find (e.g. a character's name) replaced everywhere is a
    // literal find-and-replace, not a sentence rewrite. Falling through to word-level
    // ranges below keeps the rest of each sentence untouched. Sentence-level ranges are
    // still used for a single match (smoothing one passage) or a multi-word phrase find,
    // where operating on the whole sentence is the intended behavior.
    if (!useAll || !/^\S+$/.test(find)) {
      return { ranges: useAll ? sentenceMatches : [sentenceMatches[0]!], useAll }
    }
  }

  const wordMatches = locateAllTextInDoc(doc, find)
  if (wordMatches.length === 0) {
    const single = locateTextInDoc(doc, find, { exactOnly: true })
    return single ? { ranges: [single], useAll: false } : { ranges: [], useAll: false }
  }

  const useAll = wantsReplaceAll(find, wordMatches.length, replace, replaceAll)
  let ranges = useAll ? wordMatches : [wordMatches[0]!]
  if (shouldExpandWordMatchToSentence(find, replace, useAll)) {
    ranges = mergeOverlappingRanges(
      ranges.map((range) => expandRangeToSentence(doc, range.from, range.to)),
    ).map((range) => ({
      from: range.from,
      to: range.to,
      text: doc.textBetween(range.from, range.to, '\n'),
    }))
  } else {
    ranges = ranges.map((range) => ({
      from: range.from,
      to: range.to,
      text: doc.textBetween(range.from, range.to, '\n'),
    }))
  }

  return { ranges, useAll }
}

/** Tree-only fallback when no live editor is available (web server tool loop). */
export function proposeReplaceInTree(tree: DocNode, input: ReplaceTextInput): ReplaceTextResult {
  const replace = String(input.replace ?? '')
  if (!replace) return { status: 'error', message: 'replace is required' }

  const find = String(input.find ?? '').trim()
  if (!find) {
    return { status: 'error', message: 'find is required when no editor selection is active' }
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
  const hunks = buildHunksFromRanges(
    selected.map((hit) => ({ from: hit.pos.from, to: hit.pos.to, text: hit.text })),
    replace,
  )
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

/** Resolve a replace_text call against the live editor without mutating the document. */
export function resolveReplaceInEditor(
  editor: Editor,
  input: ReplaceTextInput,
  selection?: SelectionRange,
): ReplaceTextResult {
  const replace = String(input.replace ?? '')
  if (!replace) return { status: 'error', message: 'replace is required' }

  const find = String(input.find ?? '').trim()
  if (!find && selection && selection.from < selection.to) {
    const hunk: ReplaceHunk = {
      from: selection.from,
      to: selection.to,
      matchedText: selection.text,
      replace,
    }
    return {
      status: 'proposed',
      from: hunk.from,
      to: hunk.to,
      matchedText: hunk.matchedText,
      replace,
      hunks: [hunk],
      message: 'Edit proposed for the current editor selection.',
    }
  }

  if (!find) {
    return { status: 'error', message: 'find is required when no text is selected in the editor' }
  }

  const { ranges, error } = resolveFindRanges(editor.state.doc, find, replace, input.replace_all)
  if (error) {
    return { status: 'error', message: error }
  }
  if (ranges.length === 0) {
    return { status: 'not_found', message: `Could not locate passage matching: "${truncate(find)}"` }
  }

  const hunks = buildHunksFromRanges(ranges, replace)
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
        ? `Matched ${hunks.length} passages; proposed replacements for all.`
        : 'Edit proposed for author review in the editor.',
  }
}

/** Open an inline review for a replace_text tool call. Appends hunks when a review is already open. */
export function applyReplaceInEditor(
  editor: Editor,
  input: ReplaceTextInput,
  selection?: SelectionRange,
  streaming = false,
): ReplaceTextResult {
  const result = resolveReplaceInEditor(editor, input, selection)
  if (result.status !== 'proposed') return result

  const existing = getActiveReview(editor.state)
  if (existing && !existing.streaming) {
    for (const newHunk of result.hunks) {
      for (const oldHunk of existing.hunks) {
        if (rangesOverlap(newHunk, { from: oldHunk.baseFrom, to: oldHunk.baseTo })) {
          return {
            status: 'error',
            message:
              'This edit overlaps an in-progress review and was blocked. ' +
              'Reject the current review, call get_story_blocks, then replace_story with all heading and paragraph updates in one pass.',
          }
        }
      }
    }
  }

  const hunkOptions = result.hunks.map((hunk) => ({
    from: hunk.from,
    to: hunk.to,
    baseText: hunk.matchedText,
    proposedText: hunk.replace,
  }))

  if (existing && !existing.streaming) {
    const appended = editor.commands.appendReviewHunks(hunkOptions)
    if (!appended) {
      editor
        .chain()
        .startReview({
          hunks: [
            ...existing.hunks.map((hunk) => ({
              from: hunk.baseFrom,
              to: hunk.baseTo,
              baseText: hunk.baseText,
              proposedText: hunk.proposedText,
            })),
            ...hunkOptions,
          ],
          streaming,
        })
        .setTextSelection(result.hunks[result.hunks.length - 1]!.to)
        .scrollIntoView()
        .run()
      return result
    }
  } else {
    editor.chain().startReview({ hunks: hunkOptions, streaming }).run()
  }

  editor
    .chain()
    .setTextSelection(result.hunks[result.hunks.length - 1]!.to)
    .scrollIntoView()
    .run()

  return result
}

export async function executeRendererDocTool(
  editor: Editor | null,
  name: string,
  input: Record<string, unknown>,
  selection?: SelectionRange,
): Promise<unknown> {
  if (name === 'replace_text') {
    if (!editor) return { status: 'error', message: 'No editor available' }
    return applyReplaceInEditor(editor, input as unknown as ReplaceTextInput, selection, false)
  }
  if (name === 'replace_story') {
    if (!editor) return { status: 'error', message: 'No editor available' }
    return applyReplaceStoryInEditor(editor, input as unknown as ReplaceStoryInput)
  }
  return { error: `Unknown renderer tool "${name}"` }
}

function truncate(s: string, max = 80): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}
