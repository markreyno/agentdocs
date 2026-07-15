import type { JSONContent } from '@tiptap/core'

// Kept in sync with src/lib/docTree.ts by hand: the web build uses bundler-mode
// extensionless imports while Electron's tsconfig requires nodenext-style
// extensions, so the two can't share a single source file without friction.

export type DocNodeType = 'book' | 'act' | 'chapter' | 'scene' | 'paragraph' | 'sentence'

export interface DocNode {
  id: string
  type: DocNodeType
  order: number
  title?: string
  /** Docstring/summary. Heuristic fallback until an LLM-generated one replaces it. */
  summary?: string
  /** Character range in the Tiptap document, for jump-to-position. */
  pos: { from: number; to: number }
  /** Chapter-level: characters/plot threads this chapter introduces. */
  exports?: string[]
  /** Chapter-level: threads this chapter relies on from earlier in the book. */
  imports?: string[]
  meta?: { pov?: string; location?: string; timeframe?: string }
  /** Sentence nodes only: literal text. */
  text?: string
  children?: DocNode[]
}

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'])/

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean)
}

function nodeText(node: JSONContent): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(nodeText).join('')
}

/** First sentence stand-in for a real LLM-generated summary. */
function heuristicSummary(text: string): string | undefined {
  const [first] = splitSentences(text)
  return first
}

interface FlatBlock {
  node: JSONContent
  from: number
  to: number
  headingLevel?: number
  isSceneBreak?: boolean
}

/** Walks the top-level blocks of the doc, tracking character offsets as we go. */
function flattenBlocks(doc: JSONContent): FlatBlock[] {
  const blocks: FlatBlock[] = []
  let pos = 0
  for (const node of doc.content ?? []) {
    const size = nodeText(node).length + 2 // +2 approximates ProseMirror's node boundary tokens
    const from = pos
    const to = pos + size
    if (node.type === 'heading') {
      blocks.push({ node, from, to, headingLevel: node.attrs?.level ?? 1 })
    } else if (node.type === 'horizontalRule') {
      blocks.push({ node, from, to, isSceneBreak: true })
    } else if (node.type === 'paragraph') {
      blocks.push({ node, from, to })
    }
    pos = to
  }
  return blocks
}

function buildParagraph(block: FlatBlock, order: number, sceneId: string): DocNode {
  const text = nodeText(block.node)
  const id = `${sceneId}/p-${order}`
  const sentences = splitSentences(text).map((sentenceText, i) => ({
    id: `${id}/s-${i}`,
    type: 'sentence' as const,
    order: i,
    text: sentenceText,
    pos: block.node ? { from: block.from, to: block.to } : { from: 0, to: 0 },
  }))
  return {
    id,
    type: 'paragraph',
    order,
    title: sentences[0]?.text, // "signature" = opening line
    pos: { from: block.from, to: block.to },
    children: sentences,
  }
}

/**
 * Builds a Book -> [Act] -> Chapter -> Scene -> Paragraph -> Sentence tree from a Tiptap doc.
 *
 * Act is inferred, not fixed to a heading level: whichever heading levels actually
 * appear above scene-breaks are mapped top-down to Act/Chapter. If only one heading
 * level is used, Chapters attach directly to Book with no Act layer - same as a repo
 * where some modules sit at the root instead of inside a top-level folder.
 */
export function buildDocTree(doc: JSONContent, bookTitle = 'Untitled'): DocNode {
  const blocks = flattenBlocks(doc)
  const headingLevels = Array.from(
    new Set(blocks.filter((b) => b.headingLevel != null).map((b) => b.headingLevel as number)),
  ).sort((a, b) => a - b)

  // Top-down: at most the first two distinct levels are Act/Chapter, the rest fold into Scene headings.
  const actLevel = headingLevels.length >= 3 ? headingLevels[0] : undefined
  const chapterLevel = headingLevels.length >= 3 ? headingLevels[1] : headingLevels[0]
  const sceneLevel = headingLevels.length >= 3 ? headingLevels[2] : headingLevels[1]

  const book: DocNode = { id: 'book', type: 'book', order: 0, title: bookTitle, pos: { from: 0, to: 0 }, children: [] }

  let act: DocNode | undefined
  let chapter: DocNode | undefined
  let scene: DocNode | undefined
  let actOrder = 0
  let chapterOrder = 0
  let sceneOrder = 0
  let paragraphOrder = 0
  const chapterTexts: string[] = [] // accumulates for chapter-level summary fallback
  const sceneTexts: string[] = []

  const closeScene = () => {
    if (scene && sceneTexts.length) {
      scene.summary = heuristicSummary(sceneTexts.join(' '))
      sceneTexts.length = 0
    }
  }
  const closeChapter = () => {
    closeScene()
    if (chapter && chapterTexts.length) {
      chapter.summary = heuristicSummary(chapterTexts.join(' '))
      chapterTexts.length = 0
    }
  }

  const ensureChapterParent = (): DocNode => (act ?? book)
  const startNewChapter = (title: string | undefined, from: number) => {
    closeChapter()
    chapter = {
      id: act ? `${act.id}/ch-${chapterOrder}` : `book/ch-${chapterOrder}`,
      type: 'chapter',
      order: chapterOrder++,
      title,
      pos: { from, to: from },
      exports: [],
      imports: [],
      children: [],
    }
    ensureChapterParent().children!.push(chapter)
    sceneOrder = 0
    scene = undefined
  }
  const startNewScene = (title: string | undefined, from: number) => {
    closeScene()
    if (!chapter) startNewChapter(undefined, from) // scene appeared before any chapter heading
    scene = {
      id: `${chapter!.id}/sc-${sceneOrder}`,
      type: 'scene',
      order: sceneOrder++,
      title,
      pos: { from, to: from },
      meta: {},
      children: [],
    }
    chapter!.children!.push(scene)
    paragraphOrder = 0
  }

  for (const block of blocks) {
    if (actLevel !== undefined && block.headingLevel === actLevel) {
      closeChapter()
      act = {
        id: `act-${actOrder}`,
        type: 'act',
        order: actOrder++,
        title: nodeText(block.node),
        pos: { from: block.from, to: block.to },
        children: [],
      }
      book.children!.push(act)
      chapterOrder = 0
      chapter = undefined
    } else if (chapterLevel !== undefined && block.headingLevel === chapterLevel) {
      startNewChapter(nodeText(block.node), block.from)
    } else if ((sceneLevel !== undefined && block.headingLevel === sceneLevel) || block.isSceneBreak) {
      startNewScene(block.headingLevel ? nodeText(block.node) : undefined, block.from)
    } else if (block.node.type === 'paragraph') {
      if (!scene) startNewScene(undefined, block.from)
      const text = nodeText(block.node)
      if (!text.trim()) continue
      const paragraph = buildParagraph(block, paragraphOrder++, scene!.id)
      scene!.children!.push(paragraph)
      scene!.pos.to = block.to
      chapter!.pos.to = block.to
      sceneTexts.push(text)
      chapterTexts.push(text)
    }
  }
  closeChapter()

  return book
}

/** Flattens the tree into an id -> node map for O(1) lookup, e.g. a getNode(id) tool call. */
export function flattenIndex(root: DocNode): Map<string, DocNode> {
  const map = new Map<string, DocNode>()
  const walk = (node: DocNode) => {
    map.set(node.id, node)
    node.children?.forEach(walk)
  }
  walk(root)
  return map
}

export interface OutlineMatch {
  id: string
  type: DocNodeType
  title?: string
  summary?: string
  path: string[] // breadcrumb of titles from Book down to this node
}

/**
 * Coarse search over titles/summaries/exports at act/chapter/scene granularity -
 * cheap enough to run over a whole book. Use searchSentences for a fine-grained
 * follow-up once a candidate node is found.
 */
export function searchOutline(root: DocNode, query: string): OutlineMatch[] {
  const q = query.toLowerCase()
  const matches: OutlineMatch[] = []
  const walk = (node: DocNode, trail: string[]) => {
    const label = node.title ?? node.type
    const nextTrail = [...trail, label]
    if (node.type === 'act' || node.type === 'chapter' || node.type === 'scene') {
      const haystack = [node.title, node.summary, ...(node.exports ?? []), ...(node.imports ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (haystack.includes(q)) {
        matches.push({ id: node.id, type: node.type, title: node.title, summary: node.summary, path: nextTrail })
      }
    }
    node.children?.forEach((child) => walk(child, nextTrail))
  }
  walk(root, [])
  return matches
}

export interface SentenceMatch {
  sceneId: string
  paragraphId: string
  sentenceId: string
  sentenceIndex: number
  text: string
  pos: { from: number; to: number }
}

/** Fine-grained search returning scene:sentence hits, like grep returning file:line. */
export function searchSentences(root: DocNode, query: string): SentenceMatch[] {
  const q = query.toLowerCase()
  const matches: SentenceMatch[] = []
  const walk = (node: DocNode, sceneId?: string, paragraphId?: string) => {
    if (node.type === 'sentence' && node.text?.toLowerCase().includes(q)) {
      matches.push({
        sceneId: sceneId!,
        paragraphId: paragraphId!,
        sentenceId: node.id,
        sentenceIndex: node.order,
        text: node.text,
        pos: node.pos,
      })
    }
    const nextScene = node.type === 'scene' ? node.id : sceneId
    const nextParagraph = node.type === 'paragraph' ? node.id : paragraphId
    node.children?.forEach((child) => walk(child, nextScene, nextParagraph))
  }
  walk(root)
  return matches
}

export function getNode(root: DocNode, id: string): DocNode | undefined {
  return flattenIndex(root).get(id)
}
