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
