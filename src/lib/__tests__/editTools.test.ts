import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/react'
import { resolveReplaceInEditor } from '../editTools'
import { heading, paragraph, simpleDoc } from './helpers'

function editorFromDoc(...blocks: Parameters<typeof simpleDoc>) {
  const doc = simpleDoc(...blocks)
  return { state: { doc } } as unknown as Editor
}

describe('resolveReplaceInEditor phrase swaps', () => {
  it('replaces only the matched phrase, not the whole paragraph', () => {
    const editor = editorFromDoc(
      paragraph('She bought Blueberry jam at the market yesterday.'),
    )
    const result = resolveReplaceInEditor(editor, {
      find: 'Blueberry jam',
      replace: 'strawberry jam',
    })

    expect(result.status).toBe('proposed')
    if (result.status !== 'proposed') return
    expect(result.matchedText).toBe('Blueberry jam')
    expect(result.replace).toBe('strawberry jam')
    expect(result.hunks).toHaveLength(1)
    expect(result.hunks[0]!.matchedText).toBe('Blueberry jam')
  })

  it('still expands to the containing passage for longer rewrites', () => {
    const editor = editorFromDoc(
      paragraph('She bought Blueberry jam at the market yesterday.'),
    )
    const result = resolveReplaceInEditor(editor, {
      find: 'Blueberry jam',
      replace:
        'She carefully selected a jar of homemade strawberry preserves from the farmer\'s stall.',
    })

    expect(result.status).toBe('proposed')
    if (result.status !== 'proposed') return
    expect(result.matchedText).toBe('She bought Blueberry jam at the market yesterday.')
  })

  it('blocks replace_text when find is an actual heading title', () => {
    const editor = editorFromDoc(
      heading(1, 'Chapter One'),
      paragraph('Body text about Chapter One.'),
    )
    const result = resolveReplaceInEditor(editor, {
      find: 'Chapter One',
      replace: 'Chapter Two',
    })

    expect(result.status).toBe('error')
    if (result.status !== 'error') return
    expect(result.message).toMatch(/chapter heading/i)
  })
})
