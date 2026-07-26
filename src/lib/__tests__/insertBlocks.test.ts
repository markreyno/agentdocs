import { describe, expect, it } from 'vitest'
import { buildDocTree } from '../docTree'
import {
  insertPosAfterIndex,
  insertSpecsToJSON,
  proposeInsertBlocksInTree,
} from '../storyEdit'
import { heading, paragraph, simpleDoc } from './helpers'

describe('insertPosAfterIndex', () => {
  it('returns 0 for after_index -1', () => {
    expect(insertPosAfterIndex([{ from: 1, to: 5 }], -1)).toBe(0)
  })

  it('returns the position after the given block', () => {
    // heading "Hi" occupies offset 0..4 → from=1, to=3; after node = 4
    const doc = simpleDoc(heading(1, 'Hi'), paragraph('Body.'))
    const blocks: { from: number; to: number }[] = []
    doc.forEach((node, offset) => {
      blocks.push({ from: offset + 1, to: offset + node.nodeSize - 1 })
    })
    expect(insertPosAfterIndex(blocks, 0)).toBe(blocks[0]!.to + 1)
    expect(insertPosAfterIndex(blocks, 1)).toBe(blocks[1]!.to + 1)
  })

  it('errors on out-of-range index', () => {
    const result = insertPosAfterIndex([{ from: 1, to: 5 }], 3)
    expect(result).toEqual(
      expect.objectContaining({ error: expect.stringMatching(/Invalid after_index/) }),
    )
  })
})

describe('insertSpecsToJSON', () => {
  it('builds heading and paragraph nodes', () => {
    expect(
      insertSpecsToJSON([
        { kind: 'heading', text: 'Chapter Two', level: 2 },
        { kind: 'paragraph', text: 'She opened the door.' },
      ]),
    ).toEqual([
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Chapter Two' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'She opened the door.' }],
      },
    ])
  })

  it('defaults heading level to 1', () => {
    expect(insertSpecsToJSON([{ kind: 'heading', text: 'Title' }])[0]).toEqual({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Title' }],
    })
  })
})

describe('proposeInsertBlocksInTree', () => {
  const tree = buildDocTree({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'One' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'First body.' }] },
    ],
  })

  it('accepts a valid insertion after an existing block', () => {
    const result = proposeInsertBlocksInTree(tree, {
      after_index: 0,
      blocks: [
        { kind: 'heading', text: 'Two' },
        { kind: 'paragraph', text: 'New scene.' },
      ],
    })
    expect(result.status).toBe('applied')
    if (result.status !== 'applied') return
    expect(result.inserted).toBe(2)
    expect(result.after_index).toBe(0)
    expect(result.message).toMatch(/heading/i)
    expect(result.message).toMatch(/paragraph/i)
  })

  it('allows inserting at the start with after_index -1', () => {
    const result = proposeInsertBlocksInTree(tree, {
      after_index: -1,
      blocks: [{ kind: 'paragraph', text: 'Prologue.' }],
    })
    expect(result.status).toBe('applied')
    if (result.status !== 'applied') return
    expect(result.message).toMatch(/start/i)
  })

  it('rejects empty blocks', () => {
    const result = proposeInsertBlocksInTree(tree, { after_index: 0, blocks: [] })
    expect(result.status).toBe('error')
  })

  it('rejects invalid kind', () => {
    const result = proposeInsertBlocksInTree(tree, {
      after_index: 0,
      blocks: [{ kind: 'scene' as 'paragraph', text: 'Nope' }],
    })
    expect(result.status).toBe('error')
  })

  it('rejects out-of-range after_index', () => {
    const result = proposeInsertBlocksInTree(tree, {
      after_index: 99,
      blocks: [{ kind: 'paragraph', text: 'Nope' }],
    })
    expect(result.status).toBe('error')
  })
})
