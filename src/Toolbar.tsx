import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

const LIST_TYPES = [
  { label: 'Bullet list', type: 'bulletList' as const, command: 'toggleBulletList' as const },
  { label: 'Numbered list', type: 'orderedList' as const, command: 'toggleOrderedList' as const },
]

const TEXT_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'Grey', value: '#6b7280' },
  { label: 'White', value: '#ffffff' },
] as const

function keepEditorSelection(event: ReactMouseEvent) {
  event.preventDefault()
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  label: string
  children: ReactNode
}

function ToolbarButton({ onClick, isActive = false, disabled = false, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={keepEditorSelection}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      className={`px-2.5 py-1.5 rounded-md border text-sm transition-colors cursor-pointer
        ${isActive
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px bg-gray-200 mx-1 self-stretch" />
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose, ref])
}

function HeadingDropdown({ editor }: { editor: Editor }) {
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
        className={`px-2.5 py-1.5 rounded-md border text-sm transition-colors cursor-pointer flex items-center gap-1
          ${isActive
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
          }
        `}
      >
        Heading
        <span className="text-xs opacity-70" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Heading levels"
          className="absolute top-full left-0 z-10 mt-1 min-w-28 rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
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
              className={`block w-full px-3 py-1.5 text-left text-sm transition-colors cursor-pointer
                ${editor.isActive('heading', { level })
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-800 hover:bg-gray-50'
                }
              `}
            >
              H{level}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ListDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isActive = LIST_TYPES.some(({ type }) => editor.isActive(type))

  useClickOutside(containerRef, open, () => setOpen(false))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="List"
        className={`px-2.5 py-1.5 rounded-md border text-sm transition-colors cursor-pointer flex items-center gap-1
          ${isActive
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
          }
        `}
      >
        List
        <span className="text-xs opacity-70" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="List types"
          className="absolute top-full left-0 z-10 mt-1 min-w-36 rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {LIST_TYPES.map(({ label, type, command }) => (
            <button
              key={type}
              type="button"
              role="option"
              onMouseDown={keepEditorSelection}
              aria-selected={editor.isActive(type)}
              onClick={() => {
                editor.chain().focus()[command]().run()
                setOpen(false)
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm transition-colors cursor-pointer
                ${editor.isActive(type)
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-800 hover:bg-gray-50'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ColorDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentColor = editor.getAttributes('textStyle').color as string | undefined
  const isActive = currentColor !== undefined

  useClickOutside(containerRef, open, () => setOpen(false))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Text color"
        className={`px-2.5 py-1.5 rounded-md border text-sm transition-colors cursor-pointer flex items-center gap-1.5
          ${isActive
            ? 'bg-indigo-600 border-indigo-600 text-white'
            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
          }
        `}
      >
        <span
          aria-hidden="true"
          className="inline-block w-3 h-3 rounded-sm border border-gray-300"
          style={{ backgroundColor: currentColor ?? '#000000' }}
        />
        Color
        <span className="text-xs opacity-70" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Text colors"
          className="absolute top-full left-0 z-10 mt-1 min-w-36 rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
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
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors cursor-pointer
                ${currentColor === value
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-800 hover:bg-gray-50'
                }
              `}
            >
              <span
                aria-hidden="true"
                className="inline-block w-3 h-3 rounded-sm border border-gray-300 shrink-0"
                style={{ backgroundColor: value }}
              />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  return (
    <div className="sticky top-0 z-20 flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-white/95 backdrop-blur-sm w-full max-w-[8.5in] mx-auto">
      <ToolbarButton label="Bold" isActive={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton label="Italic" isActive={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" isActive={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton label="Inline code" isActive={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        {'</>'}
      </ToolbarButton>
      <ColorDropdown editor={editor} />

      <Divider />

      <ToolbarButton label="Paragraph" isActive={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
        P
      </ToolbarButton>
      <HeadingDropdown editor={editor} />
      <ListDropdown editor={editor} />
      <ToolbarButton label="Blockquote" isActive={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        " Quote
      </ToolbarButton>
      <ToolbarButton label="Code block" isActive={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        {'{ }'}
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        ↺
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        ↻
      </ToolbarButton>

      <ToolbarButton label="+agent" onClick={() => {

        console.log('placeholder for agent button, should open a modal to add a new agent')
      }}>
        +agent

      </ToolbarButton>
    </div>
  )
}
