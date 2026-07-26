import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { DocNode } from './docTree'
import type { ReplaceHunk, ReplaceTextResult } from './editTools'
import { getActiveReview } from '../extensions/InlineReview'

export type StoryBlockKind = 'heading' | 'paragraph'

export interface StoryBlockInfo {
  index: number
  kind: StoryBlockKind
  text: string
  /** Heading level (headings only). */
  level?: number
}

interface EditableStoryBlock {
  index: number
  kind: StoryBlockKind
  from: number
  to: number
  text: string
  level?: number
}

export type ReplaceStoryUpdate =
  | string
  | { index: number; replace: string }

export interface ReplaceStoryInput {
  /**
   * Full replacement list in get_story_blocks order, or targeted { index, replace } entries.
   * Indices cover both headings and body paragraphs.
   */
  blocks?: ReplaceStoryUpdate[]
  /** @deprecated Prefer `blocks` — paragraph-only indices (legacy). */
  paragraphs?: ReplaceStoryUpdate[]
}

function listEditableStoryBlocks(doc: PMNode): EditableStoryBlock[] {
  const blocks: EditableStoryBlock[] = []
  let index = 0

  doc.forEach((node, offset) => {
    const typeName = node.type.name
    if (typeName === 'horizontalRule') return

    if (typeName === 'heading') {
      const from = offset + 1
      const to = offset + node.nodeSize - 1
      blocks.push({
        index: index++,
        kind: 'heading',
        from,
        to,
        text: doc.textBetween(from, to, '\n'),
        level: (node.attrs?.level as number | undefined) ?? 1,
      })
      return
    }

    if (node.isTextblock) {
      const from = offset + 1
      const to = offset + node.nodeSize - 1
      blocks.push({
        index: index++,
        kind: 'paragraph',
        from,
        to,
        text: to > from ? doc.textBetween(from, to, '\n') : '',
      })
    }
  })

  return blocks
}

export function getStoryBlockInfos(doc: PMNode): StoryBlockInfo[] {
  return listEditableStoryBlocks(doc).map((block) => ({
    index: block.index,
    kind: block.kind,
    text: block.text,
    level: block.level,
  }))
}

export function getStoryBlocksFromTree(tree: DocNode): StoryBlockInfo[] {
  const blocks: StoryBlockInfo[] = []
  let index = 0

  const walk = (node: DocNode) => {
    if (node.type === 'act' || node.type === 'chapter' || node.type === 'scene') {
      if (node.title?.trim()) {
        blocks.push({
          index: index++,
          kind: 'heading',
          text: node.title.trim(),
        })
      }
    }
    if (node.type === 'paragraph') {
      const text =
        node.children
          ?.map((child) => child.text ?? '')
          .filter(Boolean)
          .join(' ') ?? ''
      blocks.push({ index: index++, kind: 'paragraph', text })
    }
    node.children?.forEach(walk)
  }

  walk(tree)
  return blocks
}

function headingTexts(blocks: EditableStoryBlock[]): string[] {
  return blocks.filter((b) => b.kind === 'heading').map((b) => b.text.trim()).filter(Boolean)
}

/** Remove a heading title accidentally pasted at the start of a paragraph replacement. */
function stripAccidentalHeadingPrefix(replace: string, headings: string[]): string {
  let text = replace.trimStart()
  for (const heading of headings.sort((a, b) => b.length - a.length)) {
    if (text.startsWith(heading)) {
      text = text.slice(heading.length).trimStart()
    }
  }
  return text
}

function resolveBlockReplacements(
  blocks: EditableStoryBlock[],
  raw: ReplaceStoryUpdate[] | undefined,
  legacyParagraphs: ReplaceStoryUpdate[] | undefined,
): string[] | { error: string } {
  if (legacyParagraphs?.length && !raw?.length) {
    const paragraphBlocks = blocks.filter((b) => b.kind === 'paragraph')
    const resolved = paragraphBlocks.map((b) => b.text)
    if (typeof legacyParagraphs[0] === 'string') {
      if (legacyParagraphs.length !== paragraphBlocks.length) {
        return {
          error:
            `Expected ${paragraphBlocks.length} paragraph replacements, got ${legacyParagraphs.length}. ` +
            'Call get_story_blocks first.',
        }
      }
      for (let i = 0; i < paragraphBlocks.length; i++) {
        resolved[i] = stripAccidentalHeadingPrefix(String(legacyParagraphs[i]), headingTexts(blocks))
      }
      return mergeParagraphUpdates(blocks, resolved)
    }
    for (const entry of legacyParagraphs as { index: number; replace: string }[]) {
      const block = paragraphBlocks[entry.index]
      if (!block) {
        return { error: `Invalid paragraph index ${entry.index}` }
      }
      resolved[entry.index] = stripAccidentalHeadingPrefix(entry.replace, headingTexts(blocks))
    }
    return mergeParagraphUpdates(blocks, resolved)
  }

  const input = raw
  if (!Array.isArray(input) || input.length === 0) {
    return { error: 'blocks must be a non-empty array (or use legacy paragraphs)' }
  }

  if (typeof input[0] === 'string') {
    if (input.length !== blocks.length) {
      return {
        error:
          `Expected ${blocks.length} block replacements, got ${input.length}. ` +
          'Call get_story_blocks first — indices include headings and paragraphs.',
      }
    }
    return blocks.map((block, i) => {
      let replace = String(input[i])
      if (block.kind === 'paragraph') {
        replace = stripAccidentalHeadingPrefix(replace, headingTexts(blocks))
      }
      return replace
    })
  }

  const resolved = blocks.map((block) => block.text)
  for (const entry of input as { index: number; replace: string }[]) {
    if (typeof entry.index !== 'number' || typeof entry.replace !== 'string') {
      return { error: 'Each update must have index (number) and replace (string)' }
    }
    const block = blocks[entry.index]
    if (!block) {
      return { error: `Invalid block index ${entry.index}; document has ${blocks.length} blocks` }
    }
    let replace = entry.replace
    if (block.kind === 'paragraph') {
      replace = stripAccidentalHeadingPrefix(replace, headingTexts(blocks))
    }
    resolved[entry.index] = replace
  }

  return resolved
}

function mergeParagraphUpdates(blocks: EditableStoryBlock[], paragraphTexts: string[]): string[] {
  const resolved = blocks.map((b) => b.text)
  const paragraphBlocks = blocks.filter((b) => b.kind === 'paragraph')
  for (let i = 0; i < paragraphBlocks.length; i++) {
    const block = paragraphBlocks[i]!
    resolved[block.index] = paragraphTexts[i] ?? block.text
  }
  return resolved
}

function buildStoryHunks(blocks: EditableStoryBlock[], replacements: string[]): ReplaceHunk[] {
  const hunks: ReplaceHunk[] = []
  for (const block of blocks) {
    const replace = replacements[block.index] ?? block.text
    if (replace === block.text) continue
    hunks.push({
      from: block.from,
      to: block.to,
      matchedText: block.text,
      replace,
    })
  }
  return hunks
}

function resolveStoryEdit(
  blocks: EditableStoryBlock[],
  input: ReplaceStoryInput,
): ReplaceTextResult {
  if (blocks.length === 0) {
    return { status: 'error', message: 'No editable blocks found in the document' }
  }

  const resolved = resolveBlockReplacements(blocks, input.blocks, input.paragraphs)
  if (!Array.isArray(resolved)) {
    return { status: 'error', message: resolved.error }
  }

  const hunks = buildStoryHunks(blocks, resolved)
  if (hunks.length === 0) {
    return { status: 'error', message: 'No block changes proposed' }
  }

  const changedKinds = blocks
    .filter((block) => (resolved[block.index] ?? block.text) !== block.text)
    .reduce<Record<StoryBlockKind, number>>(
      (acc, block) => {
        acc[block.kind] = (acc[block.kind] ?? 0) + 1
        return acc
      },
      { heading: 0, paragraph: 0 },
    )
  const headingCount = changedKinds.heading
  const paragraphCount = changedKinds.paragraph
  const parts: string[] = []
  if (headingCount) parts.push(`${headingCount} heading${headingCount === 1 ? '' : 's'}`)
  if (paragraphCount) parts.push(`${paragraphCount} paragraph${paragraphCount === 1 ? '' : 's'}`)

  const first = hunks[0]!
  return {
    status: 'proposed',
    from: first.from,
    to: first.to,
    matchedText: first.matchedText,
    replace: first.replace,
    hunks,
    message:
      `Consolidated story edit: ${parts.join(' and ')} proposed. ` +
      'Scene breaks preserved; headings and paragraphs are separate non-overlapping blocks.',
  }
}

export function resolveReplaceStoryInEditor(editor: Editor, input: ReplaceStoryInput): ReplaceTextResult {
  return resolveStoryEdit(listEditableStoryBlocks(editor.state.doc), input)
}

export function proposeReplaceStoryInTree(tree: DocNode, input: ReplaceStoryInput): ReplaceTextResult {
  const infos = getStoryBlocksFromTree(tree)
  const pseudoBlocks: EditableStoryBlock[] = infos.map((info) => ({
    index: info.index,
    kind: info.kind,
    from: 0,
    to: 0,
    text: info.text,
    level: info.level,
  }))
  return resolveStoryEdit(pseudoBlocks, input)
}

/** One non-overlapping review; clears any prior review first. */
export function applyReplaceStoryInEditor(editor: Editor, input: ReplaceStoryInput): ReplaceTextResult {
  const result = resolveReplaceStoryInEditor(editor, input)
  if (result.status !== 'proposed') return result

  const existing = getActiveReview(editor.state)
  if (
    existing &&
    !existing.streaming &&
    existing.hunks.length === result.hunks.length &&
    existing.hunks.every(
      (hunk, i) =>
        hunk.baseFrom === result.hunks[i]!.from &&
        hunk.baseTo === result.hunks[i]!.to &&
        hunk.proposedText === result.hunks[i]!.replace,
    )
  ) {
    return result
  }

  editor.commands.rejectReview()

  const hunkOptions = result.hunks.map((hunk) => ({
    from: hunk.from,
    to: hunk.to,
    baseText: hunk.matchedText,
    proposedText: hunk.replace,
  }))

  editor
    .chain()
    .startReview({ hunks: hunkOptions, streaming: false })
    .setTextSelection(result.hunks[result.hunks.length - 1]!.to)
    .scrollIntoView()
    .run()

  return result
}

/** @deprecated Use getStoryBlockInfos */
export function listEditableBlocks(doc: PMNode) {
  return listEditableStoryBlocks(doc)
    .filter((b) => b.kind === 'paragraph')
    .map((b) => ({
      index: b.index,
      from: b.from,
      to: b.to,
      text: b.text,
    }))
}

export interface InsertBlockSpec {
  kind: StoryBlockKind
  text: string
  /** Heading level when kind is "heading" (defaults to 1). */
  level?: number
}

export interface InsertBlocksInput {
  /**
   * Insert after this get_story_blocks index.
   * Use -1 to insert at the start of the document.
   */
  after_index: number
  blocks: InsertBlockSpec[]
}

export type InsertBlocksResult =
  | {
      status: 'applied'
      after_index: number
      inserted: number
      from: number
      to: number
      message: string
    }
  | { status: 'error'; message: string }

function normalizeInsertSpecs(raw: unknown): InsertBlockSpec[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'blocks must be a non-empty array of { kind, text }' }
  }

  const specs: InsertBlockSpec[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'Each block must be an object with kind ("heading" | "paragraph") and text' }
    }
    const obj = entry as Record<string, unknown>
    const kind = obj.kind
    if (kind !== 'heading' && kind !== 'paragraph') {
      return { error: 'kind must be "heading" or "paragraph"' }
    }
    const text = String(obj.text ?? '').trim()
    if (!text) {
      return { error: 'block text is required' }
    }
    const level =
      kind === 'heading'
        ? typeof obj.level === 'number' && obj.level >= 1 && obj.level <= 3
          ? obj.level
          : 1
        : undefined
    specs.push({ kind, text, ...(level != null ? { level } : {}) })
  }
  return specs
}

/** Document position immediately after the given story block, or 0 for after_index -1. */
export function insertPosAfterIndex(
  blocks: { from: number; to: number }[],
  afterIndex: number,
): number | { error: string } {
  if (!Number.isInteger(afterIndex)) {
    return { error: 'after_index must be an integer (-1 to insert at the start)' }
  }
  if (afterIndex === -1) return 0
  if (blocks.length === 0) {
    return { error: 'Document has no blocks; use after_index: -1 to insert at the start' }
  }
  const block = blocks[afterIndex]
  if (!block) {
    return {
      error:
        `Invalid after_index ${afterIndex}; document has ${blocks.length} blocks ` +
        `(indices 0–${blocks.length - 1}), or use -1 for start`,
    }
  }
  // block.to is the last content position inside the node; +1 is after the node.
  return block.to + 1
}

export function insertSpecsToJSON(specs: InsertBlockSpec[]): JSONContent[] {
  return specs.map((spec) => {
    if (spec.kind === 'heading') {
      return {
        type: 'heading',
        attrs: { level: spec.level ?? 1 },
        content: [{ type: 'text', text: spec.text }],
      }
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: spec.text }],
    }
  })
}

function describeInsert(specs: InsertBlockSpec[], afterIndex: number): string {
  const headingCount = specs.filter((s) => s.kind === 'heading').length
  const paragraphCount = specs.filter((s) => s.kind === 'paragraph').length
  const parts: string[] = []
  if (headingCount) parts.push(`${headingCount} heading${headingCount === 1 ? '' : 's'}`)
  if (paragraphCount) parts.push(`${paragraphCount} paragraph${paragraphCount === 1 ? '' : 's'}`)
  const where =
    afterIndex === -1 ? 'at the start of the document' : `after block index ${afterIndex}`
  return `Inserted ${parts.join(' and ')} ${where}. Author can Undo to reverse.`
}

function resolveInsertBlocks(
  blocks: EditableStoryBlock[],
  input: InsertBlocksInput,
):
  | { specs: InsertBlockSpec[]; afterIndex: number; pos: number }
  | { error: string } {
  const specs = normalizeInsertSpecs(input.blocks)
  if (!Array.isArray(specs)) return specs

  const afterIndex = Number(input.after_index)
  const pos = insertPosAfterIndex(blocks, afterIndex)
  if (typeof pos !== 'number') return pos

  return { specs, afterIndex, pos }
}

/** Tree-only validation for the web/desktop tool loop when no live editor is available. */
export function proposeInsertBlocksInTree(tree: DocNode, input: InsertBlocksInput): InsertBlocksResult {
  const infos = getStoryBlocksFromTree(tree)
  const pseudoBlocks: EditableStoryBlock[] = infos.map((info) => ({
    index: info.index,
    kind: info.kind,
    from: 0,
    to: 0,
    text: info.text,
    level: info.level,
  }))
  const resolved = resolveInsertBlocks(pseudoBlocks, input)
  if ('error' in resolved) {
    return { status: 'error', message: resolved.error }
  }
  return {
    status: 'applied',
    after_index: resolved.afterIndex,
    inserted: resolved.specs.length,
    from: 0,
    to: 0,
    message: describeInsert(resolved.specs, resolved.afterIndex),
  }
}

/** Insert new heading/paragraph nodes into the live editor (applies immediately). */
export function applyInsertBlocksInEditor(editor: Editor, input: InsertBlocksInput): InsertBlocksResult {
  const blocks = listEditableStoryBlocks(editor.state.doc)
  const resolved = resolveInsertBlocks(blocks, input)
  if ('error' in resolved) {
    return { status: 'error', message: resolved.error }
  }

  const { specs, afterIndex, pos } = resolved
  const content = insertSpecsToJSON(specs)

  editor.commands.rejectReview()

  const ok = editor
    .chain()
    .insertContentAt(pos, content)
    .setTextSelection(pos + 1)
    .scrollIntoView()
    .run()

  if (!ok) {
    return { status: 'error', message: 'Failed to insert blocks into the editor' }
  }

  // Approximate the end of the inserted region for status reporting.
  const insertedText = specs.map((s) => s.text).join('\n')
  return {
    status: 'applied',
    after_index: afterIndex,
    inserted: specs.length,
    from: pos,
    to: pos + insertedText.length + specs.length * 2,
    message: describeInsert(specs, afterIndex),
  }
}
