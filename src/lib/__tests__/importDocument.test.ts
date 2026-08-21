import { describe, expect, it } from 'vitest'
import { buildDocTree } from '../docTree'
import {
  blocksToJSON,
  deriveManuscriptTitle,
  groupPdfSpansIntoLines,
  htmlToBlocks,
  manuscriptFromHtml,
  pdfLinesToBlocks,
  recognizeOutline,
  sanitizeImportedText,
  type PdfTextSpan,
} from '../importBlocks'

function outlineTitles(tree: ReturnType<typeof buildDocTree>, type: 'act' | 'chapter' | 'scene') {
  const titles: string[] = []
  const walk = (node: ReturnType<typeof buildDocTree>) => {
    if (node.type === type) titles.push(node.title ?? '')
    node.children?.forEach(walk)
  }
  walk(tree)
  return titles
}

describe('manuscriptFromHtml', () => {
  it('turns Word-style headings into chapters the tree can see', () => {
    const { json, title } = manuscriptFromHtml(
      '<h1>Chapter 1</h1><p>The door opened.</p><h1>Chapter 2</h1><p>Rain began.</p>',
      'my-novel.docx',
    )
    const tree = buildDocTree(json, title)

    expect(title).toBe('my novel')
    expect(outlineTitles(tree, 'chapter')).toEqual(['Chapter 1', 'Chapter 2'])
    expect(tree.children).toHaveLength(2)
    expect(tree.children![0]!.children![0]!.children![0]!.children![0]!.text).toBe('The door opened.')
  })

  it('promotes unstyled Act/Chapter/Scene lines into a three-level tree', () => {
    const { json, title } = manuscriptFromHtml(
      [
        '<p>Act I</p>',
        '<p>Chapter 1: The Gate</p>',
        '<p>Scene 1</p>',
        '<p>The lantern swung.</p>',
        '<p>Chapter 2</p>',
        '<p>The Crossing</p>',
        '<p>Dust on the road.</p>',
      ].join(''),
      'draft.docx',
    )
    const tree = buildDocTree(json, title)

    expect(outlineTitles(tree, 'act')).toEqual(['Act I'])
    expect(outlineTitles(tree, 'chapter')).toEqual(['Chapter 1: The Gate', 'Chapter 2: The Crossing'])
    expect(outlineTitles(tree, 'scene')).toEqual(['Scene 1', ''])
    expect(tree.children![0]!.type).toBe('act')
    expect(tree.children![0]!.children![0]!.title).toBe('Chapter 1: The Gate')
  })

  it('promotes fully bold short titles and *** scene breaks', () => {
    const { json } = manuscriptFromHtml(
      [
        '<p><strong>Chapter 1</strong></p>',
        '<p>Before the break.</p>',
        '<p>* * *</p>',
        '<p>After the break.</p>',
      ].join(''),
    )
    const tree = buildDocTree(json)
    const chapter = tree.children![0]!
    expect(chapter.type).toBe('chapter')
    expect(chapter.title).toBe('Chapter 1')
    expect(chapter.children).toHaveLength(2)
  })

  it('uses a leading book title and does not turn it into a chapter', () => {
    const { title, json } = manuscriptFromHtml(
      '<h1>Riverlight</h1><h1>Chapter 1</h1><p>She waited.</p>',
      'ignored.docx',
    )
    const tree = buildDocTree(json, title)
    expect(title).toBe('Riverlight')
    expect(outlineTitles(tree, 'chapter')).toEqual(['Chapter 1'])
  })

  it('does not promote ordinary sentences that merely mention chapters or parts', () => {
    const blocks = recognizeOutline(
      htmlToBlocks('<p>Part of me wanted to leave.</p><p>Chapter closed on that idea.</p>'),
    )
    expect(blocks.every((block) => block.kind === 'paragraph')).toBe(true)
  })

  it('decodes entities and keeps list prose as paragraphs', () => {
    const blocks = htmlToBlocks('<p>Tom &amp; Lily.</p><ul><li>Packed a bag.</li></ul>')
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Tom & Lily.' },
      { kind: 'paragraph', text: 'Packed a bag.' },
    ])
  })
})

describe('pdf outline recognition', () => {
  it('groups same-line spans and uses larger fonts as headings', () => {
    const spans: PdfTextSpan[] = [
      { str: 'Chapter', x: 72, y: 700, width: 60, fontSize: 24, page: 1 },
      { str: '1', x: 136, y: 700, width: 12, fontSize: 24, page: 1 },
      { str: 'The lantern swung in the hall.', x: 72, y: 660, width: 200, fontSize: 12, page: 1 },
      { str: 'Chapter', x: 72, y: 500, width: 60, fontSize: 24, page: 1 },
      { str: '2', x: 136, y: 500, width: 12, fontSize: 24, page: 1 },
      { str: 'Rain began before dawn.', x: 72, y: 460, width: 180, fontSize: 12, page: 1 },
    ]
    const tree = buildDocTree(blocksToJSON(pdfLinesToBlocks(groupPdfSpansIntoLines(spans))), 'PDF')
    expect(outlineTitles(tree, 'chapter')).toEqual(['Chapter 1', 'Chapter 2'])
    expect(tree.children![0]!.children![0]!.children![0]!.children![0]!.text).toBe(
      'The lantern swung in the hall.',
    )
  })

  it('promotes Act/Chapter lines even when the PDF has a single font size', () => {
    const blocks = pdfLinesToBlocks([
      { text: 'Act I', fontSize: 12, y: 700, page: 1 },
      { text: 'Chapter 1', fontSize: 12, y: 680, page: 1 },
      { text: 'Scene 1', fontSize: 12, y: 660, page: 1 },
      { text: 'Someone knocked twice.', fontSize: 12, y: 640, page: 1 },
    ])
    const tree = buildDocTree(blocksToJSON(blocks))
    expect(tree.children![0]!.type).toBe('act')
    expect(tree.children![0]!.title).toBe('Act I')
    expect(tree.children![0]!.children![0]!.title).toBe('Chapter 1')
    expect(tree.children![0]!.children![0]!.children![0]!.title).toBe('Scene 1')
  })

  it('does not treat most slightly-larger short lines as headings', () => {
    const lines = Array.from({ length: 40 }, (_, index) => ({
      text: index % 4 === 0 ? `Short line ${index}` : `This is ordinary body copy number ${index} with a period.`,
      fontSize: index % 4 === 0 ? 18 : 12,
      y: 800 - index * 16,
      page: 1,
    }))
    const blocks = pdfLinesToBlocks(lines)
    const headings = blocks.filter((block) => block.kind === 'heading')
    expect(headings.length).toBe(0)
  })
})

describe('sanitizeImportedText', () => {
  it('strips unpaired surrogates and null bytes', () => {
    expect(sanitizeImportedText(`Hello\u0000 \uD800world\uDFFF`)).toBe('Hello world')
    expect(sanitizeImportedText('Keep 😀 emoji')).toBe('Keep 😀 emoji')
  })
})

describe('deriveManuscriptTitle', () => {
  it('falls back to the filename when every heading is structural', () => {
    const result = deriveManuscriptTitle(
      recognizeOutline(htmlToBlocks('<p>Chapter 1</p><p>Hello.</p>')),
      'coast-road.docx',
    )
    expect(result.title).toBe('coast road')
  })
})
