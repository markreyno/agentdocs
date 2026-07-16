import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { buildPosMap, computeDiff, posAtOffset } from './diffEngine'

type Patch =
  | { kind: 'delete'; from: number; to: number }
  | { kind: 'insert'; at: number; text: string }

function isWithinSingleTextblock(doc: PMNode, from: number, to: number): boolean {
  const $from = doc.resolve(from)
  const $to = doc.resolve(to)
  return $from.parent === $to.parent && $from.parent.isTextblock
}

function clampToTextblock(doc: PMNode, from: number, to: number): { from: number; to: number } {
  const $from = doc.resolve(from)
  const parent = $from.parent
  if (!parent.isTextblock) return { from, to }

  const blockStart = $from.start()
  const blockEnd = $from.end()
  return {
    from: Math.max(from, blockStart),
    to: Math.min(to, blockEnd),
  }
}

function normalizeProposedForBlock(proposed: string): string {
  return proposed.replace(/\r?\n+/g, ' ')
}

function buildPatches(baseText: string, proposedText: string): Patch[] {
  const patches: Patch[] = []
  let offset = 0

  for (const op of computeDiff(baseText, proposedText)) {
    if (op.type === 'equal') {
      offset += op.text.length
    } else if (op.type === 'delete') {
      patches.push({ kind: 'delete', from: offset, to: offset + op.text.length })
      offset += op.text.length
    } else {
      patches.push({ kind: 'insert', at: offset, text: op.text })
    }
  }

  return patches
}

function patchSortKey(patch: Patch): number {
  return patch.kind === 'delete' ? patch.to : patch.at
}

function mapOffset(
  tr: Transaction,
  positions: number[],
  offset: number,
  rangeFrom: number,
  bias: -1 | 1,
): number {
  return tr.mapping.map(posAtOffset(positions, offset, rangeFrom), bias)
}

/**
 * Apply a review hunk without flattening block structure or stripping inline marks.
 * Edits stay inside the containing paragraph/heading; newlines in proposed text
 * are collapsed to spaces so blocks are not split or merged.
 */
export function applyReviewHunkToTransaction(
  tr: Transaction,
  from: number,
  to: number,
  baseText: string,
  proposedText: string,
): void {
  if (!proposedText && to <= from) return

  let rangeFrom = from
  let rangeTo = to
  if (!isWithinSingleTextblock(tr.doc, from, to)) {
    const clamped = clampToTextblock(tr.doc, from, to)
    rangeFrom = clamped.from
    rangeTo = clamped.to
  }

  if (rangeTo < rangeFrom && !proposedText) return

  const actualBase = tr.doc.textBetween(rangeFrom, rangeTo, '\n')
  const baseForDiff = actualBase || baseText
  const proposedForDiff = normalizeProposedForBlock(proposedText)

  if (!baseForDiff && proposedForDiff) {
    const insertPos = tr.mapping.map(rangeFrom, 1)
    const marks = tr.doc.resolve(insertPos).marks()
    tr.insert(insertPos, tr.doc.type.schema.text(proposedForDiff, marks))
    return
  }

  if (baseForDiff === proposedForDiff) return

  const { positions } = buildPosMap(tr.doc, rangeFrom, rangeTo, '\n')
  const patches = buildPatches(baseForDiff, proposedForDiff).sort((a, b) => patchSortKey(b) - patchSortKey(a))

  for (const patch of patches) {
    if (patch.kind === 'delete') {
      const delFrom = mapOffset(tr, positions, patch.from, rangeFrom, 1)
      const delTo = mapOffset(tr, positions, patch.to, rangeFrom, -1)
      if (delTo > delFrom) tr.delete(delFrom, delTo)
    } else if (patch.text) {
      const insertPos = mapOffset(tr, positions, patch.at, rangeFrom, 1)
      const marks = tr.doc.resolve(insertPos).marks()
      tr.insert(insertPos, tr.doc.type.schema.text(patch.text, marks))
    }
  }
}
