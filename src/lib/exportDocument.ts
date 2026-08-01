/** Client-side export helpers for TipTap HTML → Word / PDF. */

function sanitizeFilename(title: string | undefined): string {
  const trimmed = title?.trim()
  const base = trimmed && trimmed !== 'Untitled document' ? trimmed : 'Untitled document'
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim() || 'Untitled document'
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function wrapDocumentHtml(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page { size: letter; margin: 1in; }
  body {
    font-family: Aptos, Calibri, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
  }
  h1 { font-size: 24pt; }
  h2 { font-size: 18pt; }
  h3 { font-size: 14pt; }
  h4, h5, h6 { font-size: 12pt; }
  p { margin: 0 0 0.75em; }
  blockquote {
    margin: 0 0 0.75em;
    padding-left: 1em;
    border-left: 3px solid #ccc;
    color: #444;
  }
  ul, ol { margin: 0 0 0.75em; padding-left: 1.5em; }
  hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
  pre, code { font-family: "Courier New", monospace; }
  pre {
    background: #f5f5f5;
    padding: 0.75em;
    overflow-x: auto;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Download editor HTML as a Word-compatible .doc file. */
export function exportToWord(html: string, title?: string): void {
  const filenameBase = sanitizeFilename(title)
  const source = '\ufeff' + wrapDocumentHtml(html, filenameBase)
  const blob = new Blob([source], {
    type: 'application/msword;charset=utf-8',
  })
  triggerDownload(blob, `${filenameBase}.doc`)
}

/**
 * Open a print window so the user can save as PDF
 * (browser "Save as PDF" / "Microsoft Print to PDF").
 */
export function exportToPdf(html: string, title?: string): void {
  const filenameBase = sanitizeFilename(title)
  const printWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!printWindow) {
    // Popup blocked — fall back to printing the current document content via iframe
    printViaIframe(wrapDocumentHtml(html, filenameBase))
    return
  }

  printWindow.document.open()
  printWindow.document.write(wrapDocumentHtml(html, filenameBase))
  printWindow.document.close()
  printWindow.document.title = filenameBase

  const triggerPrint = () => {
    printWindow.focus()
    printWindow.print()
  }

  if (printWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 250)
  } else {
    printWindow.onload = () => setTimeout(triggerPrint, 250)
  }
}

function printViaIframe(fullHtml: string) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(fullHtml)
  doc.close()

  const cleanup = () => iframe.remove()
  iframe.contentWindow?.focus()
  setTimeout(() => {
    iframe.contentWindow?.print()
    setTimeout(cleanup, 1000)
  }, 250)
}
