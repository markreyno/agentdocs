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
export function locateTextInDoc(doc: PMNode, needle: string): DocRange | null {
  const search = needle.trim()
  if (!search) return null

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
      // Map normalized index back approximately via expanding whitespace walk
      idx = mapNormIndexToRaw(fullText, normIdx)
      len = mapNormIndexToRaw(fullText, normIdx + normNeedle.length) - idx
    }
  }

  if (idx < 0) {
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
