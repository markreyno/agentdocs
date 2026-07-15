import { getNode, searchOutline, searchSentences, type DocNode } from './docTree'

/** Anthropic tool schemas exposing docTree's search/lookup functions to the model. */
export const DOC_TOOLS = [
  {
    name: 'search_outline',
    description:
      'Coarse search over the manuscript\'s Act/Chapter/Scene titles and summaries. ' +
      'Use this first to find where in the book something happens before drilling into sentence-level search.',
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
      'like grep returning file:line. Use after search_outline narrows down a chapter/scene.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_node',
    description:
      'Fetch a specific node of the document tree (book/act/chapter/scene/paragraph/sentence) by id, ' +
      'including its full text and children.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Node id, e.g. "act-0/ch-2/sc-1"' },
      },
      required: ['id'],
    },
  },
] as const

export type DocToolName = (typeof DOC_TOOLS)[number]['name']

/** Runs a doc tool call against the current tree. Returns a JSON-serializable result. */
export function executeDocTool(tree: DocNode, name: string, input: Record<string, unknown>): unknown {
  switch (name as DocToolName) {
    case 'search_outline':
      return searchOutline(tree, String(input.query ?? ''))
    case 'search_sentences':
      return searchSentences(tree, String(input.query ?? ''))
    case 'get_node': {
      const node = getNode(tree, String(input.id ?? ''))
      return node ?? { error: `No node with id "${input.id}"` }
    }
    default:
      return { error: `Unknown tool "${name}"` }
  }
}
