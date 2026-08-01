import { Editor } from '@tiptap/react'
import { useRef, useState } from 'react'
import { exportToPdf, exportToWord } from '../lib/exportDocument'
import { ExportIcon, Icon, PdfFileIcon, WordFileIcon } from './icons'
import { ToolbarButton } from './ToolbarButton'
import { useClickOutside } from './useClickOutside'

interface ExportDropdownProps {
  editor: Editor
  documentTitle?: string
}

export function ExportDropdown({ editor, documentTitle }: ExportDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, open, () => setOpen(false))

  const runAndClose = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <ToolbarButton label="Export" isActive={open} onClick={() => setOpen((prev) => !prev)}>
        <Icon><ExportIcon /></Icon>
      </ToolbarButton>

      {open && (
        <div role="menu" aria-label="Export document" className="outlook-dropdown">
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              runAndClose(() => exportToWord(editor.getHTML(), documentTitle))
            }
            className="outlook-dropdown-item"
          >
            <Icon size={14}><WordFileIcon /></Icon>
            Word (.doc)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              runAndClose(() => exportToPdf(editor.getHTML(), documentTitle))
            }
            className="outlook-dropdown-item"
          >
            <Icon size={14}><PdfFileIcon /></Icon>
            PDF
          </button>
        </div>
      )}
    </div>
  )
}
