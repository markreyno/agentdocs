import { describe, expect, it } from 'vitest'
import {
  computeDiff,
  buildPosMap,
  posAtOffset,
} from '../diffEngine'
import { heading, paragraph, simpleDoc } from './helpers'

describe('computeDiff', () => {
  it('returns empty for identical empty strings', () => {
    expect(computeDiff('', '')).toEqual([])
  })

  it('returns a single equal op when texts match', () => {
    expect(computeDiff('hello', 'hello')).toEqual([{ type: 'equal', text: 'hello' }])
  })

  it('marks pure insertions', () => {
    const ops = computeDiff('', 'new text')
    expect(ops).toEqual([{ type: 'insert', text: 'new text' }])
  })

  it('marks pure deletions', () => {
    const ops = computeDiff('old text', '')
    expect(ops).toEqual([{ type: 'delete', text: 'old text' }])
  })

  it('preserves shared prose around a word rewrite', () => {
    const ops = computeDiff(
      'She walked into the garden quietly.',
      'She walked into the garden slowly.',
    )
    const equal = ops.filter((op) => op.type === 'equal').map((op) => op.text).join('')
    expect(equal).toContain('She walked into the garden')
    expect(ops.some((op) => op.type === 'delete')).toBe(true)
    expect(ops.some((op) => op.type === 'insert')).toBe(true)
    // Reconstruct proposed from ops to prove the manuscript rewrite is exact
    const reconstructed = ops
      .filter((op) => op.type !== 'delete')
      .map((op) => op.text)
      .join('')
    expect(reconstructed).toBe('She walked into the garden slowly.')
  })
})

describe('buildPosMap / posAtOffset', () => {
  it('maps each character of a single paragraph to a document position', () => {
    const doc = simpleDoc(paragraph('abc'))
    const end = doc.content.size
    const { text, positions } = buildPosMap(doc, 0, end, '\n')

    expect(text).toBe('abc')
    expect(positions).toHaveLength(3)
    expect(doc.textBetween(positions[0]!, positions[0]! + 1)).toBe('a')
    expect(doc.textBetween(positions[2]!, positions[2]! + 1)).toBe('c')
  })

  it('inserts synthetic separators between blocks', () => {
    const doc = simpleDoc(paragraph('ab'), paragraph('cd'))
    const end = doc.content.size
    const { text, positions } = buildPosMap(doc, 0, end, '\n')

    expect(text).toBe('ab\ncd')
    expect(positions).toHaveLength(5)
    expect(text[2]).toBe('\n')
  })

  it('posAtOffset clamps to ends', () => {
    expect(posAtOffset([], 0, 99)).toBe(99)
    expect(posAtOffset([10, 11, 12], -1, 99)).toBe(10)
    expect(posAtOffset([10, 11, 12], 0, 99)).toBe(10)
    expect(posAtOffset([10, 11, 12], 2, 99)).toBe(12)
    expect(posAtOffset([10, 11, 12], 99, 50)).toBe(50)
  })

  it('maps heading + body text without losing characters', () => {
    const doc = simpleDoc(heading(1, 'Title'), paragraph('Body'))
    const end = doc.content.size
    const { text, positions } = buildPosMap(doc, 0, end, '\n')

    expect(text).toBe('Title\nBody')
    expect(positions).toHaveLength(text.length)
  })
})
