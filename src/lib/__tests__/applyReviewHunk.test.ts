import { describe, expect, it } from 'vitest'
import { applyReviewHunkToTransaction } from '../applyReviewHunk'
import { editorStateFromDoc, paragraph, simpleDoc } from './helpers'

function applyHunk(
  text: string,
  find: string,
  proposed: string,
): string {
  const doc = simpleDoc(paragraph(text))
  const state = editorStateFromDoc(doc)
  const full = doc.textBetween(0, doc.content.size, '\n')
  const idx = full.indexOf(find)
  if (idx < 0) throw new Error(`find not in doc: ${find}`)

  // Map string offset → PM positions via textBetween positions for the paragraph.
  const from = 1 + idx // paragraph text starts at pos 1 in a single-paragraph doc
  const to = from + find.length
  const tr = state.tr
  applyReviewHunkToTransaction(tr, from, to, find, proposed)
  return tr.doc.textBetween(0, tr.doc.content.size, '\n')
}

describe('applyReviewHunkToTransaction', () => {
  it('replaces a word without mangling surrounding manuscript text', () => {
    expect(applyHunk('She walked into the garden quietly.', 'quietly', 'slowly')).toBe(
      'She walked into the garden slowly.',
    )
  })

  it('is a no-op when proposed text matches the base', () => {
    expect(applyHunk('Leave this alone.', 'Leave this alone.', 'Leave this alone.')).toBe(
      'Leave this alone.',
    )
  })

  it('can delete a span by proposing empty text', () => {
    expect(applyHunk('One two three.', ' two', '')).toBe('One three.')
  })

  it('collapses newlines in proposed text so blocks are not split', () => {
    expect(applyHunk('A single line.', 'single line', 'broken\nline')).toBe('A broken line.')
  })

  it('inserts into an empty range', () => {
    const doc = simpleDoc(paragraph('Hello world'))
    const state = editorStateFromDoc(doc)
    // After "Hello " (positions: <p> Hello[space] world </p> → insert at 7)
    const tr = state.tr
    applyReviewHunkToTransaction(tr, 7, 7, '', 'brave ')
    expect(tr.doc.textBetween(0, tr.doc.content.size, '\n')).toBe('Hello brave world')
  })

  it('does not flatten sibling paragraphs when editing one of them', () => {
    const doc = simpleDoc(paragraph('First paragraph.'), paragraph('Second paragraph.'))
    const state = editorStateFromDoc(doc)
    const first = 'First paragraph.'
    const from = 1
    const to = from + first.length
    const tr = state.tr
    applyReviewHunkToTransaction(tr, from, to, first, 'Revised first.')

    expect(tr.doc.childCount).toBe(2)
    expect(tr.doc.textBetween(0, tr.doc.content.size, '\n')).toBe(
      'Revised first.\nSecond paragraph.',
    )
  })
})
