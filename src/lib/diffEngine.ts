import DiffMatchPatch from 'diff-match-patch'
import type { Node as PMNode } from '@tiptap/pm/model'

export type DiffOp =
  | { type: 'equal'; text: string }
  | { type: 'delete'; text: string }
  | { type: 'insert'; text: string }

const dmp = new DiffMatchPatch()

/** Word/char diff with semantic cleanup — good for prose rewrites. */
export function computeDiff(base: string, proposed: string): DiffOp[] {
  if (base === proposed) {
    return base ? [{ type: 'equal', text: base }] : []
  }

  const diffs = dmp.diff_main(base, proposed)
  dmp.diff_cleanupSemantic(diffs)

  return diffs.map(([op, text]) => {
    if (op === DiffMatchPatch.DIFF_EQUAL) return { type: 'equal' as const, text }
    if (op === DiffMatchPatch.DIFF_DELETE) return { type: 'delete' as const, text }
    return { type: 'insert' as const, text }
  })
}

/**
 * Map each character in textBetween(from, to, blockSep) to a document position.
 * Synthetic block separators map to the position of the following character (or `to`).
 */
export function buildPosMap(
  doc: PMNode,
  from: number,
  to: number,
  blockSep = '\n',
): { text: string; positions: number[] } {
  const text = doc.textBetween(from, to, blockSep)
  const raw: { ch: string; pos: number }[] = []

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return
    for (let i = 0; i < node.text.length; i++) {
      const abs = pos + i
      if (abs >= from && abs < to) {
        raw.push({ ch: node.text[i]!, pos: abs })
      }
    }
  })

  const positions: number[] = []
  let ri = 0
  for (let ti = 0; ti < text.length; ti++) {
    const ch = text[ti]!
    if (ri < raw.length && raw[ri]!.ch === ch) {
      positions.push(raw[ri]!.pos)
      ri++
    } else if (blockSep && ch === blockSep[0]) {
      positions.push(ri < raw.length ? raw[ri]!.pos : to)
    } else if (ri < raw.length) {
      positions.push(raw[ri]!.pos)
      ri++
    } else {
      positions.push(to)
    }
  }

  return { text, positions }
}

/** PM position for a character offset into the mapped base text; `endPos` for offset at end. */
export function posAtOffset(positions: number[], offset: number, endPos: number): number {
  if (positions.length === 0) return endPos
  if (offset <= 0) return positions[0]!
  if (offset >= positions.length) return endPos
  return positions[offset]!
}
