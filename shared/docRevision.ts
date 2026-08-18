import { getNode, type DocNode, type DocNodeType } from './docTree.js'
import { getStoryBlocksFromTree, type StoryBlockInfo } from './storyEdit.js'

/** Git status-style change vs the last revision the agent loaded in this chat. */
export type RevisionStatus = 'added' | 'updated' | 'unchanged'

/** Last blob/tree hashes returned with content to the agent, keyed by node id. */
export interface KnownRevision {
  blob: string
  tree: string
}

export type KnownRevisions = Record<string, KnownRevision>

export interface DocStatusEntry {
  id: string
  type: DocNodeType
  title?: string
  hash: string
  status: RevisionStatus
  path: string[]
}

export type StoryBlockRevision = Omit<StoryBlockInfo, 'text'> & {
  status: RevisionStatus
  /** Full block text. Only present when this block was explicitly requested by index/id. */
  text?: string
  /** Short snippet so the index stays useful without dumping the manuscript. */
  preview?: string
  /** True when full text was omitted (default — this tool is an index, not a reader). */
  text_omitted?: boolean
}

export interface StoryBlockQuery {
  refresh?: boolean
  indices?: number[]
  ids?: string[]
}

/** get_node refuses to inline more than this many words of prose. */
export const MAX_NODE_PROSE_WORDS = 3000
/** get_story_blocks will inline at most this many requested block bodies per call. */
export const MAX_STORY_BLOCK_TEXT = 20
const PREVIEW_CHARS = 80
const CATALOG_MAX_ROWS = 80

const STRUCTURAL_TYPES = new Set<DocNodeType>(['act', 'chapter', 'scene'])

export function parseKnownRevisions(raw: unknown): KnownRevisions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: KnownRevisions = {}
  let count = 0
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 4000) break
    if (typeof id !== 'string' || id.length === 0 || id.length > 200) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const blob = (value as { blob?: unknown }).blob
    const tree = (value as { tree?: unknown }).tree
    if (typeof blob !== 'string' || typeof tree !== 'string') continue
    if (blob.length === 0 || blob.length > 16 || tree.length === 0 || tree.length > 16) continue
    out[id] = { blob, tree }
    count++
  }
  return out
}

export function revisionStatus(node: { id: string; hash?: string }, known: KnownRevisions): RevisionStatus {
  const prev = known[node.id]
  if (!prev) return 'added'
  if (node.hash && prev.tree === node.hash) return 'unchanged'
  return 'updated'
}

export function blobRevisionStatus(
  block: { id?: string; hash?: string },
  known: KnownRevisions,
): RevisionStatus {
  if (!block.id) return 'added'
  const prev = known[block.id]
  if (!prev) return 'added'
  if (block.hash && prev.blob === block.hash) return 'unchanged'
  return 'updated'
}

export function nodeWordCount(node: DocNode): number {
  if (node.type === 'sentence') {
    return (node.text ?? '').trim().split(/\s+/).filter(Boolean).length
  }
  return (node.children ?? []).reduce((sum, child) => sum + nodeWordCount(child), 0)
}

function previewText(text: string, max = PREVIEW_CHARS): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function outlineChild(node: DocNode, known: KnownRevisions) {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    summary: node.summary,
    hash: node.hash,
    words: nodeWordCount(node),
    status: revisionStatus(node, known),
  }
}

/**
 * True when get_node actually inlines prose (so the revision cache may mark it loaded).
 * Book/act never dump; oversized chapters collapse to a scene list.
 */
export function nodeReturnsProse(node: DocNode): boolean {
  if (node.type === 'book' || node.type === 'act') return false
  if (nodeWordCount(node) <= MAX_NODE_PROSE_WORDS) return true
  if (node.type === 'chapter') return !(node.children ?? []).some((child) => child.type === 'scene')
  if (node.type === 'scene') return !(node.children ?? []).some((child) => child.type === 'paragraph')
  return true
}

/** Record that the agent has loaded this node (and descendants) at the current hashes. */
export function markKnown(known: KnownRevisions, node: DocNode): void {
  if (node.blobHash && node.hash) {
    known[node.id] = { blob: node.blobHash, tree: node.hash }
  }
  node.children?.forEach((child) => markKnown(known, child))
}

export function collectDocStatus(root: DocNode, known: KnownRevisions): DocStatusEntry[] {
  const entries: DocStatusEntry[] = []
  const walk = (node: DocNode, trail: string[]) => {
    const label = node.title ?? node.type
    const nextTrail = [...trail, label]
    if (STRUCTURAL_TYPES.has(node.type)) {
      entries.push({
        id: node.id,
        type: node.type,
        title: node.title,
        hash: node.hash ?? '',
        status: revisionStatus(node, known),
        path: nextTrail,
      })
    }
    node.children?.forEach((child) => walk(child, nextTrail))
  }
  walk(root, [])
  return entries
}

/**
 * Compact git-status for the agent prompt: dirty/unloaded structural nodes only.
 * Unchanged loaded chapters stay out of the listing so the model does not re-fetch them.
 */
export function formatRevisionStatus(tree: DocNode, known: KnownRevisions): string {
  const head = `Manuscript HEAD ${tree.hash ?? 'unknown'} (${tree.title ?? 'Untitled'})`
  const loaded = Object.keys(known).length
  if (loaded === 0) {
    return [
      head,
      'Nothing loaded this chat. The catalog above is titles/summaries only.',
      'Call get_node on one chapter or scene — never get_node("book") and never use get_story_blocks to read prose.',
    ].join('\n')
  }

  const entries = collectDocStatus(tree, known).filter(
    (entry) => entry.type === 'act' || entry.type === 'chapter',
  )
  const dirty = entries.filter((entry) => entry.status !== 'unchanged')
  const unchanged = entries.filter((entry) => entry.status === 'unchanged').length

  if (dirty.length === 0) {
    return [
      head,
      `Working tree clean — ${unchanged} loaded chapter${unchanged === 1 ? '' : 's'}, no author edits.`,
      'Do not re-fetch unchanged nodes. Use search_sentences if you need a quote from a loaded passage.',
    ].join('\n')
  }

  const lines = [
    head,
    'Git-style status vs last loaded revision (M = author edited, ?? = not loaded):',
  ]
  for (const entry of dirty) {
    const code = entry.status === 'updated' ? 'M ' : '??'
    const hint = entry.status === 'updated' ? ' [author edited — re-read]' : ' [not loaded]'
    lines.push(`${code} ${entry.id}  ${entry.title ?? entry.type}${hint}`)
  }
  lines.push(
    `${unchanged} unchanged loaded chapter${unchanged === 1 ? '' : 's'}. Re-read only M lines with get_node. get_story_blocks is an index, not a reader.`,
  )
  return lines.join('\n')
}

/** Compact chapter/scene map for the prompt — titles and summaries, never body prose. */
export function formatManuscriptCatalog(tree: DocNode): string {
  const words = nodeWordCount(tree)
  const lines: string[] = [
    `Manuscript catalog (titles/summaries only, ${words} words) HEAD ${tree.hash ?? 'unknown'}`,
  ]

  const rows: string[] = []
  const walk = (node: DocNode, depth: number) => {
    if (node.type === 'act' || node.type === 'chapter' || node.type === 'scene') {
      const indent = '  '.repeat(depth)
      const title = node.title?.trim() || node.type
      const extra =
        node.type === 'scene' ? '' : node.summary ? ` — ${previewText(node.summary, 100)}` : ''
      rows.push(
        `${indent}${node.id}  ${title}  ${nodeWordCount(node)}w  rev:${node.hash ?? ''}${extra}`,
      )
    }
    const nextDepth =
      node.type === 'act' || node.type === 'chapter' || node.type === 'scene' ? depth + 1 : depth
    node.children?.forEach((child) => walk(child, nextDepth))
  }
  walk(tree, 0)

  if (rows.length === 0) {
    lines.push('(no chapters yet)')
    return lines.join('\n')
  }

  if (rows.length > CATALOG_MAX_ROWS) {
    const chapters = rows.filter((row) => /\/ch-\d+/.test(row) && !/\/sc-/.test(row))
    const shown = (chapters.length > 0 ? chapters : rows).slice(0, CATALOG_MAX_ROWS)
    lines.push(...shown)
    lines.push(`… catalog truncated. Use search_outline to find a chapter.`)
  } else {
    lines.push(...rows)
  }
  lines.push('Load prose with get_node on a chapter or scene id. Do not dump the book.')
  return lines.join('\n')
}

function requestedBlockKeys(blocks: StoryBlockInfo[], query: StoryBlockQuery): Set<number> {
  const keys = new Set<number>()
  if (query.indices) {
    for (const index of query.indices) {
      if (Number.isInteger(index) && index >= 0 && index < blocks.length) keys.add(index)
      if (keys.size >= MAX_STORY_BLOCK_TEXT) return keys
    }
  }
  if (query.ids) {
    const byId = new Map<string, number>()
    for (const block of blocks) {
      if (block.id && !byId.has(block.id)) byId.set(block.id, block.index)
    }
    for (const id of query.ids) {
      const index = byId.get(id)
      if (index != null) keys.add(index)
      if (keys.size >= MAX_STORY_BLOCK_TEXT) return keys
    }
  }
  return keys
}

/**
 * Index of the manuscript: headings + paragraph previews.
 * Full paragraph text is returned only for explicitly requested indices/ids (capped).
 * Listing does not mark the tree as loaded — that would block later get_node reads.
 */
export function getStoryBlocksForAgent(
  tree: DocNode,
  known: KnownRevisions,
  query: StoryBlockQuery = {},
): StoryBlockRevision[] {
  const blocks = getStoryBlocksFromTree(tree)
  const wanted = requestedBlockKeys(blocks, query)

  return blocks.map((block) => {
    const status = blobRevisionStatus(block, known)
    const preview = block.kind === 'heading' ? block.text : previewText(block.text)
    if (!wanted.has(block.index)) {
      return {
        index: block.index,
        kind: block.kind,
        id: block.id,
        hash: block.hash,
        treeHash: block.treeHash,
        level: block.level,
        status,
        preview,
        text_omitted: true,
      }
    }

    const node = block.id ? getNode(tree, block.id) : undefined
    if (node) markKnown(known, node)
    return { ...block, status, preview }
  })
}

export function getNodeForAgent(
  tree: DocNode,
  id: string,
  known: KnownRevisions,
  refresh = false,
): unknown {
  const node = getNode(tree, id)
  if (!node) return { error: `No node with id "${id}"` }

  const status = refresh ? 'updated' : revisionStatus(node, known)
  if (status === 'unchanged' && !refresh) {
    return {
      id: node.id,
      type: node.type,
      title: node.title,
      summary: node.summary,
      hash: node.hash,
      blobHash: node.blobHash,
      status,
      loaded: false,
      message: 'Unchanged since last read. Pass refresh: true only if you discarded this passage and must reload it.',
    }
  }

  if (!nodeReturnsProse(node)) {
    const children = (node.children ?? [])
      .filter(
        (child) =>
          child.type === 'act' ||
          child.type === 'chapter' ||
          child.type === 'scene' ||
          child.type === 'paragraph',
      )
      .map((child) => outlineChild(child, known))
    const words = nodeWordCount(node)
    const drill =
      node.type === 'scene' ? 'a paragraph' : node.type === 'chapter' ? 'a scene' : 'a chapter or scene'
    return {
      id: node.id,
      type: node.type,
      title: node.title,
      summary: node.summary,
      hash: node.hash,
      status,
      words,
      loaded: false,
      children,
      message: `This ${node.type} is ${words} words — too large to dump. Call get_node on ${drill} id from children.`,
    }
  }

  markKnown(known, node)
  return { ...node, status, words: nodeWordCount(node), loaded: true }
}

export function bookStatus(tree: DocNode, known: KnownRevisions) {
  const entries = collectDocStatus(tree, known)
  return {
    id: tree.id,
    title: tree.title,
    hash: tree.hash,
    status: revisionStatus(tree, known),
    words: nodeWordCount(tree),
    updated: entries.filter((entry) => entry.status === 'updated'),
    added: entries.filter((entry) => entry.status === 'added'),
    unchanged: entries.filter((entry) => entry.status === 'unchanged').length,
    loaded: Object.keys(known).length,
  }
}
