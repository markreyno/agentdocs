import { getNode, searchOutline, searchSentences, type DocNode } from './docTree.cjs'
import { getStoryBlocksFromTree, proposeReplaceStoryInTree, type ReplaceStoryInput } from './storyEdit.cjs'

export const RENDERER_DOC_TOOLS = ['replace_text', 'replace_story'] as const
export type RendererDocToolName = (typeof RENDERER_DOC_TOOLS)[number]

export function isRendererDocTool(name: string): name is RendererDocToolName {
  return (RENDERER_DOC_TOOLS as readonly string[]).includes(name)
}

function truncate(s: string, max = 80): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function isLikelyTitlePhrase(text: string): boolean {
  const t = text.trim()
  if (t.length < 4 || t.length > 100) return false
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 12) return false
  if (!/^[A-Z0-9"']/.test(t)) return false
  if (/\w['\u2019]s\b/.test(t) || /^the\s+/i.test(t)) return true
  return words.length <= 8
}

function proposeReplaceInTree(tree: DocNode, input: Record<string, unknown>) {
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

  const replaceAll = input.replace_all === true
  const useAll =
    replaceAll ||
    (input.replace_all !== false &&
      hits.length > 1 &&
      (/^\S+$/.test(find) || replace.trim().length > find.length + 12))
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

/** Tool schemas exposing docTree search/lookup and edit tools to any provider. Kept in sync with src/lib/docTools.ts. */
export const DOC_TOOLS = [
  {
    name: 'search_outline',
    description:
      'Coarse search over the manuscript\'s Act/Chapter/Scene titles and summaries. ' +
      'Use this first to find where in the book something happens before drilling into sentence-level search.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_sentences',
    description:
      'Fine-grained search returning individual matching sentences with their scene id and document position, ' +
      'like grep returning file:line. Use after search_outline narrows down a chapter/scene. ' +
      'When the user asks for a story-wide change, search here first and edit every matching passage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_story_blocks',
    description:
      'List every editable block in reading order: chapter headings and body paragraphs (scene breaks excluded). ' +
      'Each entry has index, kind ("heading" | "paragraph"), and text. Call before replace_story.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_node',
    description:
      'Fetch a specific node of the document tree (book/act/chapter/scene/paragraph/sentence) by id, ' +
      'including its full text and children.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Node id, e.g. "act-0/ch-2/sc-1"' },
      },
      required: ['id'],
    },
  },
  {
    name: 'replace_text',
    description:
      'Propose replacing manuscript text and open an inline review. ' +
      'For a rename or global swap (e.g. Boby → Toby), you MUST pass find (the old text), replace (the new text), ' +
      'and replace_all: true. Only omit find when the user has an active editor selection — then replace is the full new selection text. ' +
      'Blocked for chapter headings (use replace_story) and blocked when overlapping an in-progress review.',
    input_schema: {
      type: 'object' as const,
      properties: {
        find: {
          type: 'string',
          description:
            'Exact text to find and replace. Required for manuscript-wide edits when nothing is selected.',
        },
        replace: { type: 'string', description: 'The new text' },
        replace_all: {
          type: 'boolean',
          description:
            'Replace every occurrence of find. Required true for renames (e.g. Boby → Toby). Defaults to true for single-token finds.',
        },
      },
      required: ['replace'],
    },
  },
  {
    name: 'replace_story',
    description:
      'Propose one consolidated story-wide edit. Replaces headings and/or body paragraphs by index from get_story_blocks. ' +
      'Each block is edited independently — headings never merge into paragraphs. Use for story-wide rewrites, ' +
      'renaming chapter titles (e.g. "The Garden\'s Secret" → "The Cafe\'s Secret"), and fixing botched batch edits. ' +
      'Pass updates: [{ index, replace }, ...] for only changed blocks, or a full blocks string array (same length as get_story_blocks). ' +
      'This tool can only overwrite the text of blocks that already exist — it cannot insert a brand-new heading or paragraph. ' +
      'For requests that need new content inserted (a new scene, chapter, or character), do not call this tool for the insertion; ' +
      'instead give the user the drafted text and tell them where to paste it. ' +
      'Clears any in-progress review and opens a single non-overlapping review.',
    input_schema: {
      type: 'object' as const,
      properties: {
        blocks: {
          type: 'array',
          description:
            'Full block list in get_story_blocks order, or { index, replace } updates. Indices include headings and paragraphs.',
          items: { type: 'string' },
        },
        paragraphs: {
          type: 'array',
          description: 'Legacy: paragraph-only updates (prefer blocks).',
          items: { type: 'string' },
        },
      },
    },
  },
] as const

export type DocToolName = (typeof DOC_TOOLS)[number]['name']

/** Runs a doc tool call against the current tree. Returns a JSON-serializable result. */
export function executeDocTool(tree: DocNode, name: string, input: Record<string, unknown>): unknown {
  if (isRendererDocTool(name)) {
    if (name === 'replace_text') return proposeReplaceInTree(tree, input)
    if (name === 'replace_story') {
      return proposeReplaceStoryInTree(tree, input as unknown as ReplaceStoryInput)
    }
    return { error: `Unknown renderer tool "${name}"` }
  }

  switch (name as DocToolName) {
    case 'search_outline':
      return searchOutline(tree, String(input.query ?? ''))
    case 'search_sentences':
      return searchSentences(tree, String(input.query ?? ''))
    case 'get_story_blocks':
      return getStoryBlocksFromTree(tree)
    case 'get_node': {
      const node = getNode(tree, String(input.id ?? ''))
      return node ?? { error: `No node with id "${input.id}"` }
    }
    default:
      return { error: `Unknown tool "${name}"` }
  }
}
