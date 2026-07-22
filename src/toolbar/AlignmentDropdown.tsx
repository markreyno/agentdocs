import { Editor } from '@tiptap/react'
import { useRef, useState } from 'react'
import { TEXT_ALIGNS } from './constants'
import { AlignIcon } from './icons'
import { keepEditorSelection } from './keepEditorSelection'
import { useClickOutside } from './useClickOutside'

export function AlignmentDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeAlign = TEXT_ALIGNS.find(({ value }) => editor.isActive({ textAlign: value }))?.value ?? 'left'

  useClickOutside(containerRef, open, () => setOpen(false))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Text alignment"
        className="outlook-btn"
      >
        <AlignIcon align={activeAlign} />
      </button>

      {open && (
        <div role="listbox" aria-label="Text alignment" className="outlook-dropdown">
          {TEXT_ALIGNS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              role="option"
              onMouseDown={keepEditorSelection}
              aria-selected={editor.isActive({ textAlign: value })}
              onClick={() => {
                editor.chain().focus().setTextAlign(value).run()
                setOpen(false)
              }}
              className={`outlook-dropdown-item flex items-center gap-2 ${editor.isActive({ textAlign: value }) ? 'outlook-dropdown-item-active' : ''}`}
            >
              <AlignIcon align={value} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
