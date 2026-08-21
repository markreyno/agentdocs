import {
  blocksToHtml,
  deriveManuscriptTitle,
  groupPdfSpansIntoLines,
  htmlToBlocks,
  pdfLinesToBlocks,
  recognizeOutline,
  type PdfTextSpan,
} from './importBlocks'

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

export interface ImportedDocument {
  title: string
  content: string
}

const WORD_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='heading 1'] => h1:fresh",
  "p[style-name='heading 2'] => h2:fresh",
  "p[style-name='heading 3'] => h3:fresh",
  "p[style-name='heading 4'] => h4:fresh",
  "p[style-name='heading 5'] => h5:fresh",
  "p[style-name='heading 6'] => h6:fresh",
]

function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

function sniffHead(buffer: ArrayBuffer, bytes = 800): string {
  const view = new Uint8Array(buffer.slice(0, bytes))
  let offset = 0
  if (view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) offset = 3
  return new TextDecoder('utf-8').decode(view.subarray(offset)).trimStart()
}

function isHtmlWordDocument(buffer: ArrayBuffer): boolean {
  const head = sniffHead(buffer)
  return /^<!DOCTYPE html/i.test(head) || /^<html[\s>]/i.test(head)
}

function isPdfMagic(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer)
  return view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46
}

function isZipMagic(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer)
  return view[0] === 0x50 && view[1] === 0x4b
}

function isOleDocMagic(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer)
  return view[0] === 0xd0 && view[1] === 0xcf && view[2] === 0x11 && view[3] === 0xe0
}

function blocksToManuscript(
  blocks: ReturnType<typeof htmlToBlocks>,
  filename: string,
): ImportedDocument {
  const outlined = recognizeOutline(blocks)
  const { title, blocks: next } = deriveManuscriptTitle(outlined, filename)
  const content = blocksToHtml(next)
  if (!content || content === '<p></p>') {
    throw new ImportError('No readable text was found in that file.')
  }
  return { title, content }
}

async function importDocx(buffer: ArrayBuffer): Promise<ReturnType<typeof htmlToBlocks>> {
  const mammothMod = await import('mammoth')
  const convertToHtml = resolveConvertToHtml(mammothMod)
  const result = await convertToHtml(
    { arrayBuffer: buffer },
    { styleMap: WORD_STYLE_MAP },
  )
  return htmlToBlocks(result.value)
}

function resolveConvertToHtml(mod: unknown): (
  input: { arrayBuffer: ArrayBuffer },
  options?: { styleMap?: string | string[] },
) => Promise<{ value: string }> {
  const record = mod as {
    convertToHtml?: (input: { arrayBuffer: ArrayBuffer }, options?: { styleMap?: string | string[] }) => Promise<{ value: string }>
    default?: { convertToHtml?: (input: { arrayBuffer: ArrayBuffer }, options?: { styleMap?: string | string[] }) => Promise<{ value: string }> }
  }
  const fn = record.convertToHtml ?? record.default?.convertToHtml
  if (!fn) throw new ImportError('Word import is unavailable in this build.')
  return fn
}

let pdfWorkerReady = false

async function ensurePdfWorker(
  pdfjs: typeof import('pdfjs-dist'),
): Promise<void> {
  if (pdfWorkerReady) return
  const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline')
  pdfjs.GlobalWorkerOptions.workerPort = new workerMod.default()
  pdfWorkerReady = true
}

async function importPdf(buffer: ArrayBuffer): Promise<ReturnType<typeof htmlToBlocks>> {
  const pdfjs = await import('pdfjs-dist')
  await ensurePdfWorker(pdfjs)

  const data = new Uint8Array(buffer.slice(0))
  const pdf = await pdfjs.getDocument({ data, useWasm: false }).promise
  const spans: PdfTextSpan[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!('str' in item) || typeof item.str !== 'string' || !item.str) continue
      const transform = item.transform
      const fontSize = Math.hypot(transform[0] ?? 0, transform[1] ?? 0) || item.height || 12
      spans.push({
        str: item.str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        width: item.width || 0,
        fontSize,
        page: pageNumber,
      })
    }
  }

  return pdfLinesToBlocks(groupPdfSpansIntoLines(spans))
}

export async function importManuscriptFile(file: File): Promise<ImportedDocument> {
  const filename = file.name || 'document'
  const ext = extensionOf(filename)
  const type = file.type
  const buffer = await file.arrayBuffer()

  const asPdf = ext === 'pdf' || type === 'application/pdf' || isPdfMagic(buffer)
  const asWord =
    ext === 'docx' ||
    ext === 'doc' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword'

  if (asPdf) {
    if (!isPdfMagic(buffer)) {
      throw new ImportError('That file does not look like a PDF.')
    }
    try {
      return blocksToManuscript(await importPdf(buffer), filename)
    } catch (error) {
      if (error instanceof ImportError) throw error
      throw new ImportError('Could not read that PDF. Try exporting it again, or upload a Word file.')
    }
  }

  if (asWord || isHtmlWordDocument(buffer) || isZipMagic(buffer)) {
    if (isHtmlWordDocument(buffer)) {
      return blocksToManuscript(htmlToBlocks(new TextDecoder('utf-8').decode(buffer)), filename)
    }
    if (isOleDocMagic(buffer)) {
      throw new ImportError('Older .doc files are not supported. Save the manuscript as .docx and upload again.')
    }
    if (!isZipMagic(buffer)) {
      throw new ImportError('Upload a Word (.docx) or PDF file.')
    }
    try {
      return blocksToManuscript(await importDocx(buffer), filename)
    } catch (error) {
      if (error instanceof ImportError) throw error
      throw new ImportError('Could not read that Word document. Try saving it as .docx and uploading again.')
    }
  }

  throw new ImportError('Upload a Word (.docx) or PDF file.')
}
