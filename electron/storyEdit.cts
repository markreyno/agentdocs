import type { DocNode } from './docTree.cjs'

export type StoryBlockKind = 'heading' | 'paragraph'

export interface StoryBlockInfo {
  index: number
  kind: StoryBlockKind
  text: string
  level?: number
}

interface EditableStoryBlock {
  index: number
  kind: StoryBlockKind
  text: string
  level?: number
}

export type ReplaceStoryUpdate =
  | string
  | { index: number; replace: string }

export interface ReplaceStoryInput {
  blocks?: ReplaceStoryUpdate[]
  paragraphs?: ReplaceStoryUpdate[]
}

type ReplaceStoryResult =
  | {
      status: 'proposed'
      from: number
      to: number
      matchedText: string
      replace: string
      hunks: { from: number; to: number; matchedText: string; replace: string }[]
      message: string
    }
  | { status: 'error'; message: string }

export function getStoryBlocksFromTree(tree: DocNode): StoryBlockInfo[] {
  const blocks: StoryBlockInfo[] = []
  let index = 0

  const walk = (node: DocNode) => {
    if (node.type === 'act' || node.type === 'chapter' || node.type === 'scene') {
      if (node.title?.trim()) {
        blocks.push({ index: index++, kind: 'heading', text: node.title.trim() })
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
      if (!block) return { error: `Invalid paragraph index ${entry.index}` }
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

export function proposeReplaceStoryInTree(tree: DocNode, input: ReplaceStoryInput): ReplaceStoryResult {
  const infos = getStoryBlocksFromTree(tree)
  const blocks: EditableStoryBlock[] = infos.map((info) => ({
    index: info.index,
    kind: info.kind,
    text: info.text,
    level: info.level,
  }))

  if (blocks.length === 0) {
    return { status: 'error', message: 'No editable blocks found in the document' }
  }

  const resolved = resolveBlockReplacements(blocks, input.blocks, input.paragraphs)
  if (!Array.isArray(resolved)) {
    return { status: 'error', message: resolved.error }
  }

  const hunks = blocks
    .map((block) => {
      const replace = resolved[block.index] ?? block.text
      if (replace === block.text) return null
      return { from: 0, to: 0, matchedText: block.text, replace }
    })
    .filter((hunk): hunk is NonNullable<typeof hunk> => hunk !== null)

  if (hunks.length === 0) {
    return { status: 'error', message: 'No block changes proposed' }
  }

  const first = hunks[0]!
  return {
    status: 'proposed',
    from: first.from,
    to: first.to,
    matchedText: first.matchedText,
    replace: first.replace,
    hunks,
    message:
      `Consolidated story edit: ${hunks.length} block${hunks.length === 1 ? '' : 's'} proposed. ` +
      'Scene breaks preserved; headings and paragraphs are separate non-overlapping blocks.',
  }
}

export interface InsertBlockSpec {
  kind: StoryBlockKind
  text: string
  level?: number
}

export interface InsertBlocksInput {
  after_index: number
  blocks: InsertBlockSpec[]
}

type InsertBlocksResult =
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

export function proposeInsertBlocksInTree(tree: DocNode, input: InsertBlocksInput): InsertBlocksResult {
  const infos = getStoryBlocksFromTree(tree)
  const specs = normalizeInsertSpecs(input.blocks)
  if (!Array.isArray(specs)) {
    return { status: 'error', message: specs.error }
  }

  const afterIndex = Number(input.after_index)
  if (!Number.isInteger(afterIndex)) {
    return { status: 'error', message: 'after_index must be an integer (-1 to insert at the start)' }
  }
  if (afterIndex !== -1) {
    if (infos.length === 0) {
      return {
        status: 'error',
        message: 'Document has no blocks; use after_index: -1 to insert at the start',
      }
    }
    if (!infos[afterIndex]) {
      return {
        status: 'error',
        message:
          `Invalid after_index ${afterIndex}; document has ${infos.length} blocks ` +
          `(indices 0–${infos.length - 1}), or use -1 for start`,
      }
    }
  }

  const headingCount = specs.filter((s) => s.kind === 'heading').length
  const paragraphCount = specs.filter((s) => s.kind === 'paragraph').length
  const parts: string[] = []
  if (headingCount) parts.push(`${headingCount} heading${headingCount === 1 ? '' : 's'}`)
  if (paragraphCount) parts.push(`${paragraphCount} paragraph${paragraphCount === 1 ? '' : 's'}`)
  const where =
    afterIndex === -1 ? 'at the start of the document' : `after block index ${afterIndex}`

  return {
    status: 'applied',
    after_index: afterIndex,
    inserted: specs.length,
    from: 0,
    to: 0,
    message: `Inserted ${parts.join(' and ')} ${where}. Author can Undo to reverse.`,
  }
}
