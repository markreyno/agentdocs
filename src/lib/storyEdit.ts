import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { DocNode } from './docTree'
import type { ReplaceHunk, ReplaceTextResult } from './editTools'

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
