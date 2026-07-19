import { describe, expect, it } from 'vitest'
import {
  buildDocTree,
  flattenIndex,
  getNode,
  searchOutline,
  searchSentences,
} from '../docTree'
import type { JSONContent } from '@tiptap/core'

function doc(...content: JSONContent[]): JSONContent {
  return { type: 'doc', content }
}

function p(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function h(level: number, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

function hr(): JSONContent {
  return { type: 'horizontalRule' }
}

describe('buildDocTree', () => {
  it('builds book → chapter → scene → paragraph → sentence with one heading level', () => {
    const tree = buildDocTree(
      doc(
        h(1, 'Chapter One'),
        p('First sentence. Second sentence.'),
      ),
      'My Book',
    )

    expect(tree.type).toBe('book')
    expect(tree.title).toBe('My Book')
    expect(tree.children).toHaveLength(1)

    const chapter = tree.children![0]!
    expect(chapter.type).toBe('chapter')
    expect(chapter.title).toBe('Chapter One')
    expect(chapter.children).toHaveLength(1)

    const scene = chapter.children![0]!
    expect(scene.type).toBe('scene')
    expect(scene.children).toHaveLength(1)

    const paragraph = scene.children![0]!
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)
    expect(paragraph.children![0]!.text).toBe('First sentence.')
    expect(paragraph.children![1]!.text).toBe('Second sentence.')
  })

  it('inserts an Act layer when three heading levels are present', () => {
    const tree = buildDocTree(
      doc(
        h(1, 'Act I'),
        h(2, 'Chapter 1'),
        h(3, 'Opening'),
        p('The door creaked open.'),
      ),
    )

    expect(tree.children![0]!.type).toBe('act')
    expect(tree.children![0]!.title).toBe('Act I')
    const chapter = tree.children![0]!.children![0]!
    expect(chapter.type).toBe('chapter')
    expect(chapter.title).toBe('Chapter 1')
    const scene = chapter.children![0]!
    expect(scene.type).toBe('scene')
    expect(scene.title).toBe('Opening')
  })

  it('treats horizontal rules as scene breaks', () => {
    const tree = buildDocTree(
      doc(
        h(1, 'Chapter'),
        p('Before the break.'),
        hr(),
        p('After the break.'),
      ),
    )

    const chapter = tree.children![0]!
    expect(chapter.children).toHaveLength(2)
    expect(chapter.children![0]!.children![0]!.children![0]!.text).toBe('Before the break.')
    expect(chapter.children![1]!.children![0]!.children![0]!.text).toBe('After the break.')
  })

  it('skips empty paragraphs and still creates a scene for prose without headings', () => {
    const tree = buildDocTree(doc(p(''), p('Only prose here.')))

    expect(tree.children).toHaveLength(1)
    const chapter = tree.children![0]!
    expect(chapter.type).toBe('chapter')
    expect(chapter.children![0]!.children).toHaveLength(1)
    expect(chapter.children![0]!.children![0]!.children![0]!.text).toBe('Only prose here.')
  })

  it('fills heuristic summaries from the first sentence', () => {
    const tree = buildDocTree(
      doc(h(1, 'Ch'), p('Alpha leads. Beta follows.')),
    )
    const chapter = tree.children![0]!
    expect(chapter.summary).toBe('Alpha leads.')
    expect(chapter.children![0]!.summary).toBe('Alpha leads.')
  })
})

describe('flattenIndex / getNode', () => {
  it('indexes every node by id', () => {
    const tree = buildDocTree(doc(h(1, 'Ch'), p('Hello world.')))
    const index = flattenIndex(tree)

    expect(index.get('book')).toBe(tree)
    expect(getNode(tree, 'book/ch-0')?.title).toBe('Ch')
    expect(getNode(tree, 'missing')).toBeUndefined()
  })
})

describe('searchOutline / searchSentences', () => {
  const tree = buildDocTree(
    doc(
      h(1, 'The Garden'),
      p('She found the key under the mat. Later she opened the gate.'),
      h(1, 'The Tower'),
      p('Ravens circled the spire.'),
    ),
  )

  it('matches outline titles case-insensitively', () => {
    const hits = searchOutline(tree, 'garden')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.title).toBe('The Garden')
    expect(hits[0]!.path).toContain('The Garden')
  })

  it('returns sentence-level hits like grep', () => {
    const hits = searchSentences(tree, 'key under')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.text).toBe('She found the key under the mat.')
    expect(hits[0]!.sentenceIndex).toBe(0)
  })

  it('finds multiple sentence hits across chapters', () => {
    const hits = searchSentences(tree, 'the')
    expect(hits.length).toBeGreaterThan(1)
  })
})
