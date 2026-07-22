import { Editor } from '@tiptap/react'
import { useRef, useState } from 'react'
import { DEFAULT_TEXT_COLOR, TEXT_COLORS } from './constants'
import { ColorSwatch, FontColorIcon } from './icons'
import { keepEditorSelection } from './keepEditorSelection'
import { useClickOutside } from './useClickOutside'

export function ColorDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentColor = (editor.getAttributes('textStyle').color as string | undefined) ?? DEFAULT_TEXT_COLOR

  useClickOutside(containerRef, open, () => setOpen(false))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Font color"
        className={`outlook-btn ${currentColor ? 'outlook-btn-active' : ''}`}
      >
        <FontColorIcon color={currentColor} />
        <span className="text-[10px] opacity-60" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div role="listbox" aria-label="Text colors" className="outlook-dropdown">
          {TEXT_COLORS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              role="option"
              onMouseDown={keepEditorSelection}
              aria-selected={currentColor === value}
              onClick={() => {
                editor.chain().focus().setColor(value).run()
                setOpen(false)
              }}
              className={`outlook-dropdown-item ${currentColor === value ? 'outlook-dropdown-item-active' : ''}`}
            >
              <ColorSwatch color={value} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
