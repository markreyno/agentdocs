import type { JSONContent } from '@tiptap/core'

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
  /**
   * Git blob hash of this node's own text (title, paragraph body, or sentence).
   * Unchanged when a descendant is edited.
   */
  blobHash?: string
  /**
   * Git tree hash of this node plus its children. Changes when any descendant is
   * edited, so a chapter hash is a cheap dirty-check for the whole chapter.
   */
  hash?: string
}

/**
 * Short content-addressed id, analogous to a git object name. Stable for the
 * same payload; no crypto dependency (runs in the browser and Node).
 */
export function revisionHash(payload: string): string {
  let h1 = 2166136261
  let h2 = 5381
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 16777619)
    h2 = (h2 * 33 + c) | 0
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0')
  const b = (h2 >>> 0).toString(16).padStart(8, '0')
  return `${a}${b}`.slice(0, 12)
}

function nodeBlobPayload(node: DocNode): string {
  if (node.type === 'sentence') return node.text ?? ''
  if (node.type === 'paragraph') {
    return (
      node.children
        ?.map((child) => child.text ?? '')
        .filter(Boolean)
        .join(' ') ?? ''
    )
  }
  return node.title ?? ''
}

/** Bottom-up git-style blob/tree hashes. Mutates the tree in place. */
export function stampRevisions(node: DocNode): void {
  node.children?.forEach(stampRevisions)
  const blobHash = revisionHash(`blob:${node.type}:${nodeBlobPayload(node)}`)
  const childTrees = (node.children ?? []).map((child) => child.hash ?? '').join(',')
  node.blobHash = blobHash
  node.hash = revisionHash(`tree:${node.type}:${blobHash}:${childTrees}`)
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

/** Block containers that nest leaf prose (StarterKit lists / quotes). */
const CONTAINER_TYPES = new Set(['bulletList', 'orderedList', 'blockquote', 'listItem'])

/**
 * Walks the doc collecting leaf prose + structural markers, tracking character
 * offsets. Recurses into lists/blockquotes so their paragraphs are searchable —
 * otherwise searchSentences silently misses toolbar-created content while
 * locateAllTextInDoc (textBetween) still sees it.
 */
function flattenBlocks(doc: JSONContent): FlatBlock[] {
  const blocks: FlatBlock[] = []
  let pos = 0

  const pushLeaf = (node: JSONContent, extra?: Partial<FlatBlock>) => {
    const size = nodeText(node).length + 2 // +2 approximates ProseMirror open/close tokens
    const from = pos
    const to = pos + size
    blocks.push({ node, from, to, ...extra })
    pos = to
  }

  const visit = (node: JSONContent) => {
    if (node.type === 'heading') {
      pushLeaf(node, { headingLevel: node.attrs?.level ?? 1 })
      return
    }
    if (node.type === 'horizontalRule') {
      pushLeaf(node, { isSceneBreak: true })
      return
    }
    // Leaf prose: top-level paragraphs and nested ones inside lists/quotes, plus code blocks.
    if (node.type === 'paragraph' || node.type === 'codeBlock') {
      pushLeaf(node)
      return
    }
    if (CONTAINER_TYPES.has(node.type ?? '')) {
      pos += 1 // container open token
      for (const child of node.content ?? []) visit(child)
      pos += 1 // container close token
      return
    }
    // Unknown block: keep offsets moving so later blocks stay roughly aligned.
    pos += nodeText(node).length + 2
  }

  for (const node of doc.content ?? []) visit(node)
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
    } else if (
      block.isSceneBreak ||
      // Scene level and every deeper distinct level fold into scenes (h4+ when act/chapter/scene map to h1–h3).
      (sceneLevel !== undefined && block.headingLevel != null && block.headingLevel >= sceneLevel)
    ) {
      startNewScene(block.headingLevel != null ? nodeText(block.node) : undefined, block.from)
    } else if (block.node.type === 'paragraph' || block.node.type === 'codeBlock') {
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
  stampRevisions(book)

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
  /** Git tree hash of this node; compare across turns to skip unchanged sections. */
  hash?: string
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
        matches.push({
          id: node.id,
          type: node.type,
          title: node.title,
          summary: node.summary,
          path: nextTrail,
          hash: node.hash,
        })
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

export interface PassageMatch {
  paragraphId: string
  sceneId: string
  chapterId: string
  path: string[]
  /** Relevance score used to order results; meaningful only within this result set. */
  score: number
  matchedTerms: string[]
  text: string
  before?: { paragraphId: string; text: string }[]
  after?: { paragraphId: string; text: string }[]
  pos: { from: number; to: number }
}

export interface PassageSearchOptions {
  /** Restrict search to this book/act/chapter/scene/paragraph subtree. */
  scopeId?: string
  /** Maximum ranked passages to return. Clamped to 1-20. */
  limit?: number
  /** Neighboring paragraphs to include on each side. Clamped to 0-2. */
  context?: number
}

const PASSAGE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had', 'has',
  'have', 'he', 'her', 'hers', 'him', 'his', 'i', 'in', 'is', 'it', 'its', 'of', 'on',
  'or', 'she', 'that', 'the', 'their', 'them', 'they', 'this', 'to', 'was', 'were',
  'with', 'you', 'your',
])

function searchableTerms(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}']+/gu)
        ?.filter((term) => term.length > 1 && !PASSAGE_STOP_WORDS.has(term)) ?? [],
    ),
  )
}

function paragraphText(node: DocNode): string {
  return (node.children ?? [])
    .map((child) => child.text ?? '')
    .filter(Boolean)
    .join(' ')
}

/**
 * Ranked prose retrieval for agent navigation. Unlike searchSentences (literal grep),
 * this scores paragraphs by query-term coverage and phrase proximity, then returns a
 * bounded amount of neighboring prose so the model can judge a hit without loading
 * the enclosing chapter or scene.
 */
export function searchPassages(
  root: DocNode,
  query: string,
  options: PassageSearchOptions = {},
): PassageMatch[] {
  const scope = options.scopeId ? getNode(root, options.scopeId) : root
  if (!scope) return []

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const terms = searchableTerms(query)
  if (!normalizedQuery || terms.length === 0) return []

  const limit = Math.min(20, Math.max(1, Math.trunc(options.limit ?? 8)))
  const context = Math.min(2, Math.max(0, Math.trunc(options.context ?? 1)))
  const candidates: PassageMatch[] = []

  const walk = (
    node: DocNode,
    trail: string[],
    chapterId?: string,
    sceneId?: string,
  ) => {
    const nextChapter = node.type === 'chapter' ? node.id : chapterId
    const nextScene = node.type === 'scene' ? node.id : sceneId
    const nextTrail =
      node.type === 'book' || node.type === 'act' || node.type === 'chapter' || node.type === 'scene'
        ? [...trail, node.title ?? node.type]
        : trail

    if (node.type === 'paragraph' && nextChapter && nextScene) {
      const text = paragraphText(node)
      const lower = text.toLocaleLowerCase()
      const haystackTerms = new Set(searchableTerms(text))
      const matchedTerms = terms.filter((term) => haystackTerms.has(term))
      if (matchedTerms.length > 0) {
        const coverage = matchedTerms.length / terms.length
        const phraseBonus = lower.includes(normalizedQuery) ? 2 : 0
        const density = matchedTerms.reduce(
          (sum, term) => sum + Math.min(3, lower.split(term).length - 1),
          0,
        ) / Math.max(1, searchableTerms(text).length)
        const siblings = node.type === 'paragraph'
          ? (getNode(root, nextScene)?.children ?? []).filter((child) => child.type === 'paragraph')
          : []
        const index = siblings.findIndex((sibling) => sibling.id === node.id)
        const mapNeighbor = (sibling: DocNode) => ({
          paragraphId: sibling.id,
          text: paragraphText(sibling),
        })
        const before = context > 0 && index >= 0
          ? siblings.slice(Math.max(0, index - context), index).map(mapNeighbor)
          : undefined
        const after = context > 0 && index >= 0
          ? siblings.slice(index + 1, index + 1 + context).map(mapNeighbor)
          : undefined
        candidates.push({
          paragraphId: node.id,
          sceneId: nextScene,
          chapterId: nextChapter,
          path: nextTrail,
          score: Number((coverage * 10 + phraseBonus + density).toFixed(3)),
          matchedTerms,
          text,
          ...(before?.length ? { before } : {}),
          ...(after?.length ? { after } : {}),
          pos: node.pos,
        })
      }
    }
    node.children?.forEach((child) => walk(child, nextTrail, nextChapter, nextScene))
  }

  walk(scope, [])
  return candidates
    .sort((a, b) => b.score - a.score || a.pos.from - b.pos.from)
    .slice(0, limit)
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
