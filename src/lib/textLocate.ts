import type { Node as PMNode } from '@tiptap/pm/model'
import DiffMatchPatch from 'diff-match-patch'
import { buildPosMap } from './diffEngine'

export type DocRange = {
  from: number
  to: number
  text: string
}

const dmp = new DiffMatchPatch()

function normalizeWs(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

/** Map a character offset in textBetween(0, size, '\\n') to a PM position. */
function offsetToPos(doc: PMNode, offset: number): number {
  const end = doc.content.size
  const { positions } = buildPosMap(doc, 0, end, '\n')
  if (positions.length === 0) return 1
  if (offset <= 0) return positions[0]!
  if (offset >= positions.length) return end
  return positions[offset]!
}

/**
 * Find `needle` in the document. Tries exact match, then whitespace-normalized,
 * then fuzzy match near the start of the needle.
 */
export function locateTextInDoc(doc: PMNode, needle: string, options?: { exactOnly?: boolean }): DocRange | null {
  const search = needle.trim()
  if (!search) return null

  const headingOnly = locateHeadingMatches(doc, search)
  if (headingOnly.length === 1) return headingOnly[0]!
  if (headingOnly.length > 1) return headingOnly[0]!

  const end = doc.content.size
  const fullText = doc.textBetween(0, end, '\n')
  if (!fullText) return null

  let idx = fullText.indexOf(search)
  let len = search.length

  if (idx < 0) {
    const normFull = normalizeWs(fullText)
    const normNeedle = normalizeWs(search)
    const normIdx = normFull.indexOf(normNeedle)
    if (normIdx >= 0) {
      idx = mapNormIndexToRaw(fullText, normIdx)
      len = mapNormIndexToRaw(fullText, normIdx + normNeedle.length) - idx
    }
  }

  if (idx < 0 && !options?.exactOnly) {
    // Fuzzy: locate the beginning of the needle, then take needle-length window
    dmp.Match_Threshold = 0.45
    dmp.Match_Distance = Math.max(1000, fullText.length)
    const probe = search.slice(0, Math.min(64, search.length))
    const fuzzyIdx = dmp.match_main(fullText, probe, 0)
    if (fuzzyIdx < 0) return null
    idx = fuzzyIdx
    len = Math.min(search.length, fullText.length - idx)
    // Expand/shrink to nearest paragraph bounds when the match is rough
    const para = paragraphBounds(fullText, idx)
    if (para && similarity(fullText.slice(para.start, para.end), search) > similarity(fullText.slice(idx, idx + len), search)) {
      idx = para.start
      len = para.end - para.start
    }
  }

  if (idx < 0 || len <= 0) return null

  const from = offsetToPos(doc, idx)
  const to = offsetToPos(doc, idx + len)
  if (to <= from) return null

  return {
    from,
    to,
    text: doc.textBetween(from, to, '\n'),
  }
}

/** Find every non-overlapping match of `needle` in the document (case-insensitive). */
export function locateAllTextInDoc(doc: PMNode, needle: string): DocRange[] {
  const search = needle.trim()
  if (!search) return []

  const end = doc.content.size
  const fullText = doc.textBetween(0, end, '\n')
  if (!fullText) return []

  const lower = fullText.toLowerCase()
  const q = search.toLowerCase()
  const ranges: DocRange[] = []
  let idx = 0
  while (idx < lower.length) {
    const found = lower.indexOf(q, idx)
    if (found < 0) break

    const from = offsetToPos(doc, found)
    const to = offsetToPos(doc, found + search.length)
    if (to > from) {
      ranges.push({
        from,
        to,
        text: doc.textBetween(from, to, '\n'),
      })
    }
    idx = found + q.length
  }

  return ranges
}

/** Every heading node as a document range (heading text only). */
export function listHeadingRanges(doc: PMNode): DocRange[] {
  const ranges: DocRange[] = []
  doc.forEach((node, offset) => {
    if (node.type.name !== 'heading') return
    const from = offset + 1
    const to = offset + node.nodeSize - 1
    ranges.push({ from, to, text: doc.textBetween(from, to, '\n') })
  })
  return ranges
}

/** Exact (case-insensitive) heading title matches — never matches body text. */
export function locateHeadingMatches(doc: PMNode, needle: string): DocRange[] {
  const q = needle.trim().toLowerCase()
  if (!q) return []
  return listHeadingRanges(doc).filter((range) => range.text.trim().toLowerCase() === q)
}

/** True for short multi-word titles like "The Garden's Secret". */
export function isLikelyTitlePhrase(text: string): boolean {
  const t = text.trim()
  if (t.length < 4 || t.length > 100) return false
  if (/\w['\u2019]s\b/.test(t) || /^the\s+/i.test(t)) return true
  const words = t.split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.length <= 12 && /^[A-Z0-9"']/.test(t)
}

export function rangesOverlap(
  a: { from: number; to: number },
  b: { from: number; to: number },
): boolean {
  return a.from < b.to && b.from < a.to
}

/**
 * Find every sentence that contains `query` as a substring (case-insensitive).
 * Aligns with search_sentences in the doc tree — use for replace_all edits.
 */
export function locateAllSentencesContaining(doc: PMNode, query: string): DocRange[] {
  const wordMatches = locateAllTextInDoc(doc, query)
  if (wordMatches.length === 0) return []

  const sentences = wordMatches.map((match) => expandRangeToSentence(doc, match.from, match.to))
  return mergeOverlappingRanges(sentences).map((range) => ({
    from: range.from,
    to: range.to,
    text: doc.textBetween(range.from, range.to, '\n'),
  }))
}

/** Expand a document range to the containing sentence (between newlines or string bounds). */
export function expandRangeToSentence(doc: PMNode, from: number, to: number): DocRange {
  const end = doc.content.size
  const fullText = doc.textBetween(0, end, '\n')
  if (!fullText) return { from, to, text: doc.textBetween(from, to, '\n') }

  const startOffset = charOffsetAtPos(doc, from)
  const endOffset = charOffsetAtPos(doc, to)
  const bounds = sentenceBounds(fullText, startOffset, endOffset)
  const expandedFrom = offsetToPos(doc, bounds.start)
  const expandedTo = offsetToPos(doc, bounds.end)

  return {
    from: expandedFrom,
    to: expandedTo,
    text: doc.textBetween(expandedFrom, expandedTo, '\n'),
  }
}

/** Merge ranges that overlap after expansion so each passage is edited once. */
export function mergeOverlappingRanges(ranges: DocRange[]): DocRange[] {
  if (ranges.length <= 1) return ranges

  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to)
  const merged: DocRange[] = []
  let current = sorted[0]!

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!
    if (next.from <= current.to) {
      current = {
        from: current.from,
        to: Math.max(current.to, next.to),
        text: current.text,
      }
      continue
    }
    merged.push(current)
    current = next
  }

  merged.push(current)
  return merged
}

function charOffsetAtPos(doc: PMNode, pos: number): number {
  const end = doc.content.size
  const { positions } = buildPosMap(doc, 0, end, '\n')
  const clamped = Math.max(0, Math.min(pos, end))
  for (let i = 0; i < positions.length; i++) {
    if (positions[i]! >= clamped) return i
  }
  return positions.length
}

function sentenceBounds(text: string, startOffset: number, endOffset: number): { start: number; end: number } {
  let start = Math.max(0, Math.min(startOffset, text.length))
  let end = Math.max(start, Math.min(endOffset, text.length))

  while (start > 0 && text[start - 1] !== '\n') start--
  while (end < text.length && text[end] !== '\n') end++

  return { start, end }
}

function mapNormIndexToRaw(raw: string, normIndex: number): number {
  let ni = 0
  let ri = 0
  while (ri < raw.length && ni < normIndex) {
    if (/\s/.test(raw[ri]!)) {
      while (ri < raw.length && /\s/.test(raw[ri]!)) ri++
      ni++ // one space in normalized form
    } else {
      ri++
      ni++
    }
  }
  return ri
}

function paragraphBounds(text: string, at: number): { start: number; end: number } | null {
  if (!text) return null
  let start = at
  while (start > 0 && text[start - 1] !== '\n') start--
  let end = at
  while (end < text.length && text[end] !== '\n') end++
  if (end <= start) return null
  return { start, end }
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const diffs = dmp.diff_main(a, b)
  dmp.diff_cleanupSemantic(diffs)
  let equal = 0
  let total = 0
  for (const [op, text] of diffs) {
    total += text.length
    if (op === DiffMatchPatch.DIFF_EQUAL) equal += text.length
  }
  return total === 0 ? 0 : equal / total
}

/**
 * When the model didn't quote a FIND passage, pick the manuscript paragraph
 * most similar to `proposed` (likely the rewrite target).
 */
export function locateBestRewriteTarget(doc: PMNode, proposed: string): DocRange | null {
  const target = proposed.trim()
  if (!target) return null

  const end = doc.content.size
  const fullText = doc.textBetween(0, end, '\n')
  if (!fullText.trim()) return null

  const paragraphs = splitParagraphs(fullText)
  if (paragraphs.length === 0) return null

  let best: { start: number; end: number; score: number } | null = null
  for (const para of paragraphs) {
    if (para.text.trim().length < 8) continue
    const score = similarity(para.text, target)
    if (!best || score > best.score) {
      best = { start: para.start, end: para.end, score }
    }
  }

  // Require some overlap so we don't highlight unrelated text for Q&A answers
  if (!best || best.score < 0.22) return null

  const from = offsetToPos(doc, best.start)
  const to = offsetToPos(doc, best.end)
  if (to <= from) return null

  return {
    from,
    to,
    text: doc.textBetween(from, to, '\n'),
  }
}

function splitParagraphs(text: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = []
  let start = 0
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      if (i > start) {
        out.push({ start, end: i, text: text.slice(start, i) })
      }
      start = i + 1
    }
  }
  return out
}

export type FindReplacePayload = {
  find: string
  replace: string
  /** True when the FIND section is complete (REPLACE marker seen). */
  findComplete: boolean
}

/** Parse FIND:/REPLACE: blocks from model output (tolerant of streaming). */
export function parseFindReplace(content: string): FindReplacePayload | null {
  const match = content.match(/^\s*FIND:\s*\r?\n([\s\S]*?)(?:\r?\nREPLACE:\s*\r?\n([\s\S]*))?$/i)
  if (match) {
    const find = (match[1] ?? '').replace(/\n$/, '')
    const hasReplace = /REPLACE:/i.test(content)
    return {
      find: find.trimEnd(),
      replace: hasReplace ? (match[2] ?? '') : '',
      findComplete: hasReplace,
    }
  }

  // Looser: FIND/REPLACE anywhere in the message
  const findIdx = content.search(/\bFIND:\s*\r?\n/i)
  if (findIdx < 0) return null
  const afterFind = content.slice(findIdx).replace(/^\s*FIND:\s*\r?\n/i, '')
  const replaceSplit = afterFind.search(/\r?\nREPLACE:\s*\r?\n/i)
  if (replaceSplit < 0) {
    return { find: afterFind.trimEnd(), replace: '', findComplete: false }
  }
  const find = afterFind.slice(0, replaceSplit).trimEnd()
  const replace = afterFind.slice(replaceSplit).replace(/^\r?\nREPLACE:\s*\r?\n/i, '')
  return { find, replace, findComplete: true }
}

/** Text to show in the review preview (REPLACE body, or full content if unstructured). */
export function proposedFromAssistant(content: string): string {
  const parsed = parseFindReplace(content)
  if (parsed?.findComplete) return parsed.replace
  if (parsed && !parsed.findComplete) return ''
  return content
}
