import { Editor } from '@tiptap/react'
import { useRef, useState } from 'react'
import { HEADING_LEVELS } from './constants'
import { keepEditorSelection } from './keepEditorSelection'
import { useClickOutside } from './useClickOutside'

export function HeadingDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeLevel = HEADING_LEVELS.find((level) => editor.isActive('heading', { level }))
  const isActive = activeLevel !== undefined

  useClickOutside(containerRef, open, () => setOpen(false))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Heading"
        className={`outlook-combo min-w-[5.5rem] ${isActive ? 'outlook-combo-active' : ''}`}
      >
        <span>{isActive ? `Heading ${activeLevel}` : 'Heading'}</span>
        <span className="text-[10px] opacity-60 shrink-0" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div role="listbox" aria-label="Heading levels" className="outlook-dropdown">
          <button
            type="button"
            role="option"
            onMouseDown={keepEditorSelection}
            aria-selected={editor.isActive('paragraph')}
            onClick={() => {
              editor.chain().focus().setParagraph().run()
              setOpen(false)
            }}
            className={`outlook-dropdown-item ${editor.isActive('paragraph') ? 'outlook-dropdown-item-active' : ''}`}
          >
            Normal
          </button>
          {HEADING_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="option"
              onMouseDown={keepEditorSelection}
              aria-selected={editor.isActive('heading', { level })}
              onClick={() => {
                editor.chain().focus().toggleHeading({ level }).run()
                setOpen(false)
              }}
              className={`outlook-dropdown-item ${editor.isActive('heading', { level }) ? 'outlook-dropdown-item-active' : ''}`}
            >
              Heading {level}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
