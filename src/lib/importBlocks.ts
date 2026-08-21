import type { JSONContent } from '@tiptap/core'

export type ImportBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string; allBold?: boolean }
  | { kind: 'hr' }

type OutlineRole = 'act' | 'chapter' | 'scene'

type WorkingBlock =
  | { kind: 'heading'; level: number; text: string; role?: OutlineRole }
  | { kind: 'paragraph'; text: string; allBold?: boolean }
  | { kind: 'hr' }

export interface PdfTextSpan {
  str: string
  x: number
  y: number
  width: number
  fontSize: number
  page: number
}

export interface PdfLine {
  text: string
  fontSize: number
  y: number
  page: number
}

const ACT_RE =
  /^(act|part)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b(?:\s*[:.!?—–-]\s*(.*))?$/i
const CHAPTER_RE =
  /^(chapter|ch\.?)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?:\s*[:.!?—–-]\s*(.*))?$/i
const CHAPTER_BARE_RE = /^(chapter|ch\.?)$/i
const SCENE_RE = /^(scene)\b(?:\s+(.+))?$/i
const NAMED_CHAPTER_RE = /^(prologue|epilogue)\b(?:\s*[:.!?—–-]\s*(.*))?$/i
const BREAK_RE = /^(?:\*(?:\s*\*){2,}|(?:[-–—_]){3,})$/

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const n = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(n)) return full
      try {
        return String.fromCodePoint(n)
      } catch {
        return full
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? full
  })
}

/** Drop nulls, unpaired surrogates, and other controls that crash React text nodes. */
export function sanitizeImportedText(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp === 0 || (cp >= 0xd800 && cp <= 0xdfff)) continue
    if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) continue
    out += ch
  }
  return out
}

export function collapseWs(text: string): string {
  return sanitizeImportedText(
    text.replace(/\u00a0/g, ' ').replace(/[ \t\r\f\v]+/g, ' ').replace(/\n+/g, ' ').trim(),
  )
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function stripTags(html: string): string {
  return collapseWs(
    decodeEntities(
      html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '),
    ),
  )
}

function classifyOutline(text: string): OutlineRole | 'break' | null {
  const value = text.trim()
  if (!value) return null
  if (BREAK_RE.test(value)) return 'break'
  if (ACT_RE.test(value)) return 'act'
  if (CHAPTER_RE.test(value) || CHAPTER_BARE_RE.test(value) || NAMED_CHAPTER_RE.test(value)) {
    return 'chapter'
  }
  if (SCENE_RE.test(value)) return 'scene'
  return null
}

function looksLikeSubtitle(text: string): boolean {
  if (text.length > 70 || wordCount(text) > 10) return false
  if (/[.!?]["']?$/.test(text)) return false
  return classifyOutline(text) == null
}

function isAllBoldParagraph(inner: string): boolean {
  if (!/<(strong|b)\b/i.test(inner)) return false
  const full = stripTags(inner)
  if (!full) return false
  const bold = [...inner.matchAll(/<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>/gi)]
    .map((match) => stripTags(match[1] ?? ''))
    .filter(Boolean)
    .join(' ')
  return bold === full
}

function preprocessHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<\/?font\b[^>]*>/gi, '')
    .replace(/<\/?o:p\b[^>]*>/gi, '')
}

interface HtmlChunk {
  tag: string
  inner: string
}

function splitTopLevelBlocks(html: string): HtmlChunk[] {
  const source = preprocessHtml(html)
  const chunks: HtmlChunk[] = []
  const re = /<(\/)?(h[1-6]|p|div|li|blockquote|pre|ul|ol|hr)(\s[^>]*)?(\/?)>/gi
  let depth = 0
  let currentTag = ''
  let innerStart = 0
  let lastEnd = 0
  let match: RegExpExecArray | null

  const pushLoose = (from: number, to: number) => {
    const text = stripTags(source.slice(from, to))
    if (text) chunks.push({ tag: 'p', inner: text })
  }

  while ((match = re.exec(source))) {
    const closing = Boolean(match[1])
    const tag = match[2]!.toLowerCase()
    const selfClosing = Boolean(match[4]) || tag === 'hr'

    if (!closing && depth === 0) {
      pushLoose(lastEnd, match.index)
    }

    if (selfClosing && !closing) {
      if (depth === 0) {
        chunks.push({ tag, inner: '' })
        lastEnd = match.index + match[0].length
      }
      continue
    }

    if (!closing) {
      if (depth === 0) {
        currentTag = tag
        innerStart = match.index + match[0].length
      }
      depth += 1
      continue
    }

    if (depth === 0) continue
    depth -= 1
    if (depth === 0 && currentTag) {
      chunks.push({ tag: currentTag, inner: source.slice(innerStart, match.index) })
      currentTag = ''
      lastEnd = match.index + match[0].length
    }
  }

  pushLoose(lastEnd, source.length)
  return chunks
}

export function htmlToBlocks(html: string): ImportBlock[] {
  const blocks: WorkingBlock[] = []

  const visit = (markup: string) => {
    for (const chunk of splitTopLevelBlocks(markup)) {
      if (chunk.tag === 'hr') {
        blocks.push({ kind: 'hr' })
        continue
      }
      if (/^h[1-6]$/.test(chunk.tag)) {
        const text = stripTags(chunk.inner)
        if (text) {
          blocks.push({ kind: 'heading', level: Number(chunk.tag[1]), text })
        }
        continue
      }
      if (chunk.tag === 'ul' || chunk.tag === 'ol' || /<(h[1-6]|p|li|blockquote|pre|ul|ol|hr)\b/i.test(chunk.inner)) {
        visit(chunk.inner)
        continue
      }
      const text = stripTags(chunk.inner)
      if (!text) continue
      blocks.push({
        kind: 'paragraph',
        text,
        allBold: isAllBoldParagraph(chunk.inner),
      })
    }
  }

  visit(html)
  return finalizeBlocks(blocks)
}

function headingLevelForRole(role: OutlineRole, hasAct: boolean, hasChapter: boolean): number {
  if (role === 'act') return 1
  if (role === 'chapter') return hasAct ? 2 : 1
  return hasAct && hasChapter ? 3 : hasAct || hasChapter ? 2 : 1
}

function normalizeHeadingLevels(blocks: WorkingBlock[]): WorkingBlock[] {
  const used = Array.from(
    new Set(blocks.filter((block): block is Extract<WorkingBlock, { kind: 'heading' }> => block.kind === 'heading').map((block) => block.level)),
  ).sort((a, b) => a - b)
  if (used.length === 0) return blocks
  const mapped = new Map(used.map((level, index) => [level, index + 1]))
  return blocks.map((block) => {
    if (block.kind !== 'heading') return block
    return { ...block, level: mapped.get(block.level) ?? block.level }
  })
}

function foldSubtitles(blocks: WorkingBlock[]): WorkingBlock[] {
  const out: WorkingBlock[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    const next = blocks[i + 1]
    if (
      block.kind === 'heading' &&
      next?.kind === 'paragraph' &&
      looksLikeSubtitle(next.text)
    ) {
      const merged = block.text.includes(next.text) ? block.text : `${block.text}: ${next.text}`
      out.push({ ...block, text: merged })
      i += 1
      continue
    }
    out.push(block)
  }
  return out
}

export function recognizeOutline(blocks: ImportBlock[]): ImportBlock[] {
  const working: WorkingBlock[] = blocks.map((block) => {
    if (block.kind === 'hr') return block
    if (block.kind === 'paragraph') {
      const role = classifyOutline(block.text)
      if (role === 'break') return { kind: 'hr' }
      if (role) return { kind: 'heading', level: 0, text: block.text, role }
      const bold = 'allBold' in block && block.allBold
      if (bold && block.text.length <= 80 && !/[.!?]"?$/.test(block.text) && wordCount(block.text) >= 2) {
        return { kind: 'heading', level: 0, text: block.text }
      }
      return block
    }
    const role = classifyOutline(block.text)
    if (role === 'break') return { kind: 'hr' }
    if (role) return { ...block, role }
    return block
  })

  const folded = foldSubtitles(working)
  const hasAct = folded.some((block) => block.kind === 'heading' && block.role === 'act')
  const hasChapter = folded.some((block) => block.kind === 'heading' && block.role === 'chapter')

  const ranked = folded.map((block) => {
    if (block.kind !== 'heading') return block
    if (block.role) {
      return { ...block, level: headingLevelForRole(block.role, hasAct, hasChapter) }
    }
    let level = block.level || 1
    if (hasAct && level === 1) level = 2
    return { ...block, level }
  })

  return finalizeBlocks(normalizeHeadingLevels(ranked))
}

export function deriveManuscriptTitle(
  blocks: ImportBlock[],
  filename: string,
): { title: string; blocks: ImportBlock[] } {
  const fromFile = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const firstHeadingIndex = blocks.findIndex((block) => block.kind === 'heading')
  const firstHeading = firstHeadingIndex >= 0 ? blocks[firstHeadingIndex] : undefined
  const firstRole = firstHeading?.kind === 'heading' ? classifyOutline(firstHeading.text) : null
  const laterStructural = blocks.some((block, index) => {
    if (index === firstHeadingIndex || block.kind !== 'heading') return false
    const role = classifyOutline(block.text)
    return role === 'act' || role === 'chapter'
  })

  if (firstHeading?.kind === 'heading' && !firstRole && laterStructural) {
    return {
      title: firstHeading.text,
      blocks: blocks.filter((_, index) => index !== firstHeadingIndex),
    }
  }

  const title = fromFile || (firstHeading?.kind === 'heading' ? firstHeading.text : '') || 'Untitled document'
  return { title, blocks }
}

export function blocksToHtml(blocks: ImportBlock[]): string {
  const html = blocks
    .map((block) => {
      if (block.kind === 'hr') return '<hr>'
      if (block.kind === 'heading') {
        const level = Math.min(6, Math.max(1, Math.round(block.level) || 1))
        return `<h${level}>${escapeHtml(block.text)}</h${level}>`
      }
      if (!block.text.trim()) return ''
      return `<p>${escapeHtml(block.text)}</p>`
    })
    .filter(Boolean)
    .join('')
  return html || '<p></p>'
}

export function blocksToJSON(blocks: ImportBlock[]): JSONContent {
  const content: JSONContent[] = blocks.map((block) => {
    if (block.kind === 'hr') return { type: 'horizontalRule' }
    if (block.kind === 'heading') {
      return {
        type: 'heading',
        attrs: { level: Math.min(6, Math.max(1, Math.round(block.level) || 1)) },
        content: block.text ? [{ type: 'text', text: block.text }] : undefined,
      }
    }
    return {
      type: 'paragraph',
      content: block.text ? [{ type: 'text', text: block.text }] : undefined,
    }
  })
  return { type: 'doc', content }
}

export function manuscriptFromHtml(html: string, filename = 'document.docx') {
  const { title, blocks } = deriveManuscriptTitle(recognizeOutline(htmlToBlocks(html)), filename)
  return {
    title,
    blocks,
    json: blocksToJSON(blocks),
    html: blocksToHtml(blocks),
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function finalizeBlocks(blocks: WorkingBlock[]): ImportBlock[] {
  return blocks
    .map((block): ImportBlock | null => {
      if (block.kind === 'hr') return { kind: 'hr' }
      if (block.kind === 'heading') {
        const text = collapseWs(block.text)
        if (!text) return null
        return { kind: 'heading', level: block.level || 1, text }
      }
      const text = collapseWs(block.text)
      if (!text) return null
      return block.allBold ? { kind: 'paragraph', text, allBold: true } : { kind: 'paragraph', text }
    })
    .filter((block): block is ImportBlock => block != null)
}

export function groupPdfSpansIntoLines(spans: PdfTextSpan[]): PdfLine[] {
  const byPage = new Map<number, PdfTextSpan[]>()
  for (const span of spans) {
    if (!span.str.trim()) continue
    const page = byPage.get(span.page) ?? []
    page.push(span)
    byPage.set(span.page, page)
  }

  const lines: PdfLine[] = []
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const items = (byPage.get(page) ?? []).slice().sort((a, b) => b.y - a.y || a.x - b.x)
    const buckets: PdfTextSpan[][] = []
    for (const item of items) {
      const tolerance = Math.max(2, item.fontSize * 0.35)
      const bucket = buckets.find((entry) => Math.abs(entry[0]!.y - item.y) <= tolerance)
      if (bucket) bucket.push(item)
      else buckets.push([item])
    }
    for (const bucket of buckets) {
      const ordered = bucket.sort((a, b) => a.x - b.x)
      let text = ''
      let prevRight: number | null = null
      let fontSize = 0
      let y = 0
      for (const item of ordered) {
        fontSize = Math.max(fontSize, item.fontSize)
        y = y === 0 ? item.y : (y + item.y) / 2
        if (prevRight != null) {
          const gap = item.x - prevRight
          if (gap > item.fontSize * 0.12 && !text.endsWith(' ') && !item.str.startsWith(' ')) {
            text += ' '
          }
        }
        text += item.str
        prevRight = item.x + (item.width || item.str.length * item.fontSize * 0.5)
      }
      const collapsed = collapseWs(text)
      if (collapsed) {
        lines.push({ text: collapsed, fontSize: fontSize || 12, y, page })
      }
    }
  }
  return lines
}

function shouldJoinAcrossBreak(prev: string, next: string): boolean {
  return !/[.!?]["']?$/.test(prev.trim()) && /^[a-z]/.test(next.trim())
}

function modalFontSize(lines: PdfLine[]): number {
  const counts = new Map<number, number>()
  for (const line of lines) {
    const size = Math.round(line.fontSize * 10) / 10
    counts.set(size, (counts.get(size) ?? 0) + Math.max(1, line.text.length))
  }
  let best = 12
  let bestCount = 0
  for (const [size, count] of counts) {
    if (count > bestCount) {
      best = size
      bestCount = count
    }
  }
  return best
}

function headingLevelFromFont(fontSize: number, bodySize: number): number {
  const ratio = fontSize / Math.max(1, bodySize)
  if (ratio >= 1.75) return 1
  if (ratio >= 1.35) return 2
  return 3
}

export function pdfLinesToBlocks(lines: PdfLine[]): ImportBlock[] {
  if (lines.length === 0) return []
  const bodySize = modalFontSize(lines)
  const merged: { text: string; fontSize: number }[] = []
  let current: PdfLine[] = []

  const flush = () => {
    if (current.length === 0) return
    const text = collapseWs(current.map((line) => line.text).join(' '))
    const fontSize = Math.max(...current.map((line) => line.fontSize))
    if (text) merged.push({ text, fontSize })
    current = []
  }

  for (const line of lines) {
    if (current.length === 0) {
      current = [line]
      continue
    }
    const prev = current[current.length - 1]!
    const samePage = prev.page === line.page
    const gap = samePage ? Math.abs(prev.y - line.y) : Number.POSITIVE_INFINITY
    const similarSize = Math.abs(prev.fontSize - line.fontSize) <= Math.max(1, bodySize * 0.12)
    const tight = samePage && gap < prev.fontSize * 1.45 && similarSize
    const continued = !samePage && shouldJoinAcrossBreak(prev.text, line.text) && similarSize
    if (tight || continued) current.push(line)
    else {
      flush()
      current = [line]
    }
  }
  flush()

  const fontHeadingFlags = merged.map(({ text, fontSize }) => {
    const short = text.length <= 80 && wordCount(text) <= 12 && !/[.!?]"?$/.test(text)
    return short && fontSize >= bodySize * 1.35 && classifyOutline(text) == null
  })
  const fontHeadingCount = fontHeadingFlags.filter(Boolean).length
  // If "larger font" matches too much of the file, it's body-size noise — keep Act/Chapter lines only.
  const useFontHeadings =
    fontHeadingCount > 0 &&
    fontHeadingCount <= 80 &&
    fontHeadingCount / merged.length <= 0.1

  const blocks: WorkingBlock[] = merged.map(({ text, fontSize }, index) => {
    const role = classifyOutline(text)
    if (role === 'break') return { kind: 'hr' }
    if (role) {
      return { kind: 'heading', level: headingLevelFromFont(fontSize, bodySize), text, role }
    }
    if (useFontHeadings && fontHeadingFlags[index]) {
      return { kind: 'heading', level: headingLevelFromFont(fontSize, bodySize), text }
    }
    return { kind: 'paragraph', text }
  })

  return recognizeOutline(finalizeBlocks(blocks))
}
