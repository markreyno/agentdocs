import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { buildDocTree, getNode } from '../docTree'
import { executeDocTool } from '../docTools'
import {
  collectDocStatus,
  formatManuscriptCatalog,
  formatRevisionStatus,
  getStoryBlocksForAgent,
  markKnown,
  parseKnownRevisions,
  type KnownRevisions,
} from '../docRevision'

function doc(...content: JSONContent[]): JSONContent {
  return { type: 'doc', content }
}

function p(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function h(level: number, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

function manuscript() {
  return buildDocTree(
    doc(
      h(1, 'Chapter One'),
      p('Alpha leads the way.'),
      h(1, 'Chapter Two'),
      p('Beta waits at the gate.'),
    ),
    'Test Book',
  )
}

describe('revision hashes', () => {
  it('stamps stable blob and tree hashes', () => {
    const a = manuscript()
    const b = manuscript()
    expect(a.hash).toBe(b.hash)
    expect(a.hash).toMatch(/^[0-9a-f]{12}$/)
    expect(getNode(a, 'book/ch-0')?.blobHash).toBe(getNode(b, 'book/ch-0')?.blobHash)
  })

  it('changes a paragraph blob and ancestor tree hashes, not sibling chapters', () => {
    const original = manuscript()
    const edited = buildDocTree(
      doc(
        h(1, 'Chapter One'),
        p('Alpha changed her mind.'),
        h(1, 'Chapter Two'),
        p('Beta waits at the gate.'),
      ),
      'Test Book',
    )

    const origCh1 = getNode(original, 'book/ch-0')!
    const editCh1 = getNode(edited, 'book/ch-0')!
    const origCh2 = getNode(original, 'book/ch-1')!
    const editCh2 = getNode(edited, 'book/ch-1')!

    expect(editCh1.hash).not.toBe(origCh1.hash)
    expect(editCh1.blobHash).toBe(origCh1.blobHash) // title unchanged
    expect(editCh2.hash).toBe(origCh2.hash)
    expect(edited.hash).not.toBe(original.hash)
  })

  it('changes heading blob hash when only the title is renamed', () => {
    const original = manuscript()
    const renamed = buildDocTree(
      doc(
        h(1, 'Chapter One renamed'),
        p('Alpha leads the way.'),
        h(1, 'Chapter Two'),
        p('Beta waits at the gate.'),
      ),
      'Test Book',
    )

    expect(getNode(renamed, 'book/ch-0')?.blobHash).not.toBe(getNode(original, 'book/ch-0')?.blobHash)
    expect(getNode(renamed, 'book/ch-1')?.hash).toBe(getNode(original, 'book/ch-1')?.hash)
  })
})

describe('get_story_blocks revision stubs', () => {
  it('never dumps paragraph bodies on the first read — only previews', () => {
    const tree = manuscript()
    const known: KnownRevisions = {}

    const first = getStoryBlocksForAgent(tree, known)
    const paragraphs = first.filter((block) => block.kind === 'paragraph')
    expect(paragraphs.every((block) => block.text_omitted && !block.text)).toBe(true)
    expect(paragraphs.every((block) => Boolean(block.preview))).toBe(true)
    expect(Object.keys(known)).toHaveLength(0)
  })

  it('inlines full text only for explicitly requested indices', () => {
    const tree = manuscript()
    const known: KnownRevisions = {}
    const blocks = getStoryBlocksForAgent(tree, known, { indices: [3] })
    const withText = blocks.filter((block) => block.text)
    expect(withText).toHaveLength(1)
    expect(withText[0]!.index).toBe(3)
    expect(withText[0]!.text).toBe('Beta waits at the gate.')
    expect(blocks.filter((block) => block.text_omitted).length).toBe(blocks.length - 1)
  })

  it('refresh-style full dump is gone: omitting indices never returns bodies', () => {
    const tree = manuscript()
    const known: KnownRevisions = {}
    markKnown(known, tree)
    const listed = getStoryBlocksForAgent(tree, known, { refresh: true })
    expect(listed.every((block) => block.kind === 'heading' || block.text_omitted)).toBe(true)
    expect(listed.filter((block) => block.kind === 'paragraph').every((block) => !block.text)).toBe(true)
  })
})

describe('get_node and doc_status tools', () => {
  it('returns a stub for an unchanged node and full content after an edit', () => {
    const original = manuscript()
    const known: KnownRevisions = {}
    const loaded = executeDocTool(original, 'get_node', { id: 'book/ch-0' }, { knownRevisions: known }) as {
      status: string
      children?: unknown
      loaded?: boolean
    }
    expect(loaded.status).toBe('added')
    expect(loaded.children).toBeTruthy()
    expect(loaded.loaded).toBe(true)

    const stub = executeDocTool(original, 'get_node', { id: 'book/ch-0' }, { knownRevisions: known }) as {
      status: string
      children?: unknown
      message?: string
    }
    expect(stub.status).toBe('unchanged')
    expect(stub.children).toBeUndefined()
    expect(stub.message).toMatch(/Unchanged/)
  })

  it('refuses to dump the whole book', () => {
    const tree = manuscript()
    const result = executeDocTool(tree, 'get_node', { id: 'book' }, { knownRevisions: {} }) as {
      loaded: boolean
      children: { id: string }[]
      message: string
    }
    expect(result.loaded).toBe(false)
    expect(result.children.map((child) => child.id)).toEqual(['book/ch-0', 'book/ch-1'])
    expect(result.message).toMatch(/too large to dump/i)
  })

  it('doc_status lists the edited chapter as updated', () => {
    const original = manuscript()
    const known: KnownRevisions = {}
    markKnown(known, original)

    const edited = buildDocTree(
      doc(
        h(1, 'Chapter One'),
        p('Alpha leads the way.'),
        h(1, 'Chapter Two'),
        p('Beta opened the gate.'),
      ),
      'Test Book',
    )

    const status = executeDocTool(edited, 'doc_status', {}, { knownRevisions: known }) as {
      updated: { id: string }[]
      unchanged: number
    }
    expect(status.updated.some((entry) => entry.id === 'book/ch-1')).toBe(true)
    expect(status.updated.some((entry) => entry.id === 'book/ch-0')).toBe(false)
  })
})

describe('formatRevisionStatus', () => {
  it('tells the agent nothing is loaded yet', () => {
    const text = formatRevisionStatus(manuscript(), {})
    expect(text).toMatch(/Nothing loaded/)
    expect(text).toMatch(/HEAD/)
    expect(text).toMatch(/never get_node\("book"\)/)
  })

  it('reports a clean working tree after a full load with no edits', () => {
    const tree = manuscript()
    const known: KnownRevisions = {}
    markKnown(known, tree)
    const text = formatRevisionStatus(tree, known)
    expect(text).toMatch(/Working tree clean/)
  })

  it('lists author-edited chapters with M', () => {
    const original = manuscript()
    const known: KnownRevisions = {}
    markKnown(known, original)
    const edited = buildDocTree(
      doc(
        h(1, 'Chapter One'),
        p('Alpha leads the way.'),
        h(1, 'Chapter Two'),
        p('Beta opened the gate.'),
      ),
      'Test Book',
    )
    const text = formatRevisionStatus(edited, known)
    expect(text).toMatch(/^M {2}book\/ch-1/m)
    expect(text).not.toMatch(/book\/ch-0/)
    expect(collectDocStatus(edited, known).find((e) => e.id === 'book/ch-1')?.status).toBe('updated')
  })
})

describe('formatManuscriptCatalog', () => {
  it('lists chapter titles without body prose', () => {
    const tree = buildDocTree(
      doc(
        h(1, 'Chapter One'),
        p('Alpha leads the way. Secret passphrase: rusty hinge.'),
        h(1, 'Chapter Two'),
        p('Beta waits at the gate.'),
      ),
      'Test Book',
    )
    const text = formatManuscriptCatalog(tree)
    expect(text).toMatch(/Chapter One/)
    expect(text).toMatch(/Chapter Two/)
    expect(text).not.toMatch(/rusty hinge/)
    expect(text).toMatch(/Load prose with get_node/)
  })
})

describe('parseKnownRevisions', () => {
  it('accepts well-formed hashes and drops junk', () => {
    expect(parseKnownRevisions(null)).toEqual({})
    expect(
      parseKnownRevisions({
        'book/ch-0': { blob: 'aaaabbbbcccc', tree: 'ddddffffeeee' },
        bad: { blob: 1 },
        also: 'nope',
      }),
    ).toEqual({
      'book/ch-0': { blob: 'aaaabbbbcccc', tree: 'ddddffffeeee' },
    })
  })
})
