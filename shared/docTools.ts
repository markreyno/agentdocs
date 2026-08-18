import { searchOutline, searchSentences, type DocNode } from './docTree.js'
import {
  bookStatus,
  getNodeForAgent,
  getStoryBlocksForAgent,
} from './docRevision.js'
import type { KnownRevisions } from './docRevision.js'
import {
  isRendererDocTool,
  proposeReplaceInTree,
  RENDERER_DOC_TOOLS,
} from './editTools.js'
import {
  proposeInsertBlocksInTree,
  proposeReplaceStoryInTree,
  type InsertBlocksInput,
  type ReplaceStoryInput,
} from './storyEdit.js'

export interface DocToolContext {
  /** Blob/tree hashes the agent has already loaded this chat. Mutated as tools return content. */
  knownRevisions: KnownRevisions
}

/** Tool schemas exposing docTree search/lookup and edit tools to the model. */
export const DOC_TOOLS = [
  {
    name: 'search_outline',
    description:
      'Coarse search over the manuscript\'s Act/Chapter/Scene titles, summaries, and revision hashes. ' +
      'Use this first to find where in the book something happens before drilling into sentence-level search. ' +
      'Does not load full prose — safe to call even when most chapters are already loaded.',
    input_schema: {
      type: 'object',
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
      'Hits are capped; narrow the query if results are truncated. ' +
      'When the user asks for a story-wide change, search here first and edit every matching passage.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'doc_status',
    description:
      'Git status for the manuscript: which chapters/scenes changed since you last loaded them. ' +
      'Returns HEAD hash plus updated (M) and not-loaded (??) nodes. Call this instead of re-reading the whole book.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_story_blocks',
    description:
      'Index of editable blocks in reading order (headings and paragraphs). Returns index, kind, id, hash, and a short preview — never the full manuscript. ' +
      'Use this for replace_story / insert_blocks indices. To read prose, call get_node on a chapter or scene. ' +
      'Pass indices or ids (max 20) only when you need those specific block bodies for an edit.',
    input_schema: {
      type: 'object',
      properties: {
        indices: {
          type: 'array',
          items: { type: 'number' },
          description: 'Optional block indices whose full text should be included (max 20). Default: none.',
        },
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional node ids whose full text should be included (max 20). Default: none.',
        },
      },
    },
  },
  {
    name: 'get_node',
    description:
      'Load one chapter, scene, paragraph, or sentence by id. Never pass "book" or an act to read prose — those return a child outline only. ' +
      'Oversized chapters return a scene list instead of dumping thousands of words. ' +
      'If you already loaded this node and the author has not edited it, returns a stub; pass refresh: true to reload that one node.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Node id, e.g. "act-0/ch-2/sc-1"' },
        refresh: {
          type: 'boolean',
          description: 'If true, return full text even when unchanged. Default false.',
        },
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
      type: 'object',
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
      'This tool can only overwrite the text of blocks that already exist — for brand-new headings or paragraphs use insert_blocks. ' +
      'Clears any in-progress review and opens a single non-overlapping review.',
    input_schema: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          description:
            'Full block list in get_story_blocks order, or { index, replace } updates. Indices include headings and paragraphs.',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  index: { type: 'number', description: 'Block index from get_story_blocks' },
                  replace: { type: 'string', description: 'New heading or paragraph text (not both)' },
                },
                required: ['index', 'replace'],
              },
            ],
          },
        },
        paragraphs: {
          type: 'array',
          description: 'Legacy: paragraph-only updates (prefer blocks).',
          items: { type: 'string' },
        },
      },
    },
  },
  {
    name: 'insert_blocks',
    description:
      'Insert one or more brand-new headings and/or paragraphs into the manuscript. ' +
      'Call get_story_blocks first, then pass after_index (block index to insert after; use -1 for the start) ' +
      'and blocks: [{ kind: "heading"|"paragraph", text, level? }, ...]. ' +
      'Use when the user asks to add a new scene, chapter, paragraph, or character introduction. ' +
      'Applies immediately (not an inline review); the author can Undo. Clears any in-progress review.',
    input_schema: {
      type: 'object',
      properties: {
        after_index: {
          type: 'number',
          description:
            'Insert after this get_story_blocks index. Use -1 to insert at the start of the document.',
        },
        blocks: {
          type: 'array',
          description: 'New blocks to insert, in order.',
          items: {
            type: 'object',
            properties: {
              kind: {
                type: 'string',
                enum: ['heading', 'paragraph'],
                description: 'Whether this block is a heading or a body paragraph',
              },
              text: { type: 'string', description: 'Heading or paragraph text' },
              level: {
                type: 'number',
                description: 'Heading level 1–3 (headings only; defaults to 1)',
              },
            },
            required: ['kind', 'text'],
          },
        },
      },
      required: ['after_index', 'blocks'],
    },
  },
] as const

export type DocToolName = (typeof DOC_TOOLS)[number]['name']

export { isRendererDocTool, RENDERER_DOC_TOOLS }

/**
 * Runs a doc tool call against the current tree. Renderer tools (replace_text, replace_story, insert_blocks)
 * use a tree fallback here; the live editor applies the edit via executeRendererDocTool / AgentSidebar.
 * `ctx.knownRevisions` is mutated when read tools return full content so later calls in the same
 * turn skip unchanged nodes.
 */
export function executeDocTool(
  tree: DocNode,
  name: string,
  input: Record<string, unknown>,
  ctx?: DocToolContext,
): unknown {
  if (isRendererDocTool(name)) {
    if (name === 'replace_text') {
      return proposeReplaceInTree(tree, input as { find?: string; replace: string })
    }
    if (name === 'replace_story') {
      return proposeReplaceStoryInTree(tree, input as unknown as ReplaceStoryInput)
    }
    if (name === 'insert_blocks') {
      return proposeInsertBlocksInTree(tree, input as unknown as InsertBlocksInput)
    }
    return { error: `Unknown renderer tool "${name}"` }
  }

  const known = ctx?.knownRevisions ?? {}
  const refresh = input.refresh === true

  switch (name as DocToolName) {
    case 'search_outline':
      return searchOutline(tree, String(input.query ?? ''))
    case 'search_sentences': {
      const hits = searchSentences(tree, String(input.query ?? ''))
      const cap = 40
      return {
        matches: hits.slice(0, cap),
        total: hits.length,
        truncated: hits.length > cap,
        ...(hits.length > cap
          ? {
              message: `Showing ${cap} of ${hits.length} hits. Narrow the query or search_outline first.`,
            }
          : {}),
      }
    }
    case 'doc_status':
      return bookStatus(tree, known)
    case 'get_story_blocks':
      return getStoryBlocksForAgent(tree, known, {
        indices: Array.isArray(input.indices)
          ? input.indices.filter((value): value is number => typeof value === 'number')
          : undefined,
        ids: Array.isArray(input.ids) ? input.ids.map(String) : undefined,
      })
    case 'get_node':
      return getNodeForAgent(tree, String(input.id ?? ''), known, refresh)
    default:
      return { error: `Unknown tool "${name}"` }
  }
}
