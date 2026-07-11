import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type SVGProps } from 'react'

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

const DEFAULT_TEXT_COLOR = '#000000'

const TEXT_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'Dark red', value: '#c00000' },
  { label: 'Blue', value: '#0078d4' },
  { label: 'Green', value: '#107c10' },
  { label: 'Grey', value: '#6b7280' },
] as const

const FONT_FAMILIES = [
  { label: 'Aptos', value: 'Aptos, Calibri, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
] as const

const FONT_SIZES = [
  { label: '8', value: '8px' },
  { label: '9', value: '9px' },
  { label: '10', value: '10px' },
  { label: '11', value: '11px' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
] as const

const TEXT_ALIGNS = [
  { label: 'Align left', value: 'left' },
  { label: 'Align center', value: 'center' },
  { label: 'Align right', value: 'right' },
  { label: 'Justify', value: 'justify' },
] as const

function keepEditorSelection(event: ReactMouseEvent) {
  event.preventDefault()
}

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {children}
    </span>
  )
}

function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M10.5 3.5a.5.5 0 0 0-.7-.7L4.6 8l5.2 5.2a.5.5 0 1 0 .7-.7L6.2 8l4.3-4.5z" />
    </svg>
  )
}

function PasteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M11 2H9V1a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v1H1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM4 1h4v1H4V1zm7 12H1V3h1v1h8V3h1v10z" />
      <path d="M3 5h6v1H3V5zm0 2h6v1H3V7zm0 2h4v1H3V9z" />
    </svg>
  )
}

function CutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M5.5 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM2 8l4.5-4.5L8 5l-1.5 1.5L8 8l-1.5 1.5L6.5 11 2 8zm3.5-2.5L3 8l2.5 2.5L8 8 5.5 5.5zM10.5 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    </svg>
  )
}

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M4 2a2 2 0 0 0-2 2v8h8V4a2 2 0 0 0-2-2H4zm-1 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v7H3V4zm3 1h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  )
}

function BulletListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <circle cx="2.5" cy="4" r="1" />
      <circle cx="2.5" cy="8" r="1" />
      <circle cx="2.5" cy="12" r="1" />
      <path d="M5 3.5h9v1H5v-1zm0 4h9v1H5v-1zm0 4h9v1H5v-1z" />
    </svg>
  )
}

function FindIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242 1.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
    </svg>
  )
}

function AlignIcon({ align }: { align: string }) {
  const lines = align === 'center'
    ? ['mx-auto', 'mx-auto', 'mx-auto']
    : align === 'right'
      ? ['ml-auto', 'ml-auto', 'ml-auto']
      : align === 'justify'
        ? ['w-full', 'w-full', 'w-full']
        : ['', '', '']

  return (
    <span className="inline-flex flex-col gap-[2px] w-4 h-4 justify-center">
      {lines.map((cls, i) => (
        <span
          key={i}
          className={`block h-[2px] bg-current rounded-sm ${cls}`}
          style={{ width: i === 2 ? '60%' : '100%' }}
        />
      ))}
    </span>
  )
}

function FontColorIcon({ color }: { color: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="font-semibold text-sm">A</span>
      <span className="w-4 h-[3px] rounded-sm mt-px" style={{ backgroundColor: color }} />
    </span>
  )
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  label: string
  children: ReactNode
  className?: string
}

function ToolbarButton({ onClick, isActive = false, disabled = false, label, children, className = '' }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={keepEditorSelection}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      className={`outlook-btn ${isActive ? 'outlook-btn-active' : ''} ${disabled ? 'outlook-btn-disabled' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="outlook-divider" />
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

interface StyleOption {
  label: string
  value: string
}

interface ComboDropdownProps {
  buttonLabel: string
  listAriaLabel: string
  options: readonly StyleOption[]
  selectedValue: string | undefined
  isActive?: boolean
  onSelect: (value: string) => void
  widthClass?: string
  renderButtonLeading?: (selectedValue: string | undefined) => ReactNode
  renderOptionLeading?: (value: string) => ReactNode
}

function ComboDropdown({
  buttonLabel,
  listAriaLabel,
  options,
  selectedValue,
  isActive = selectedValue !== undefined,
  onSelect,
  widthClass = 'min-w-[7rem]',
  renderButtonLeading,
  renderOptionLeading,
}: ComboDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedLabel = options.find((o) => o.value === selectedValue)?.label ?? buttonLabel

  useClickOutside(containerRef, open, () => setOpen(false))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={keepEditorSelection}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={buttonLabel}
        className={`outlook-combo ${widthClass} ${isActive ? 'outlook-combo-active' : ''}`}
      >
        {renderButtonLeading?.(selectedValue)}
        <span className="truncate">{selectedLabel}</span>
        <span className="text-[10px] opacity-60 shrink-0" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div role="listbox" aria-label={listAriaLabel} className="outlook-dropdown">
          {options.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              role="option"
              onMouseDown={keepEditorSelection}
              aria-selected={selectedValue === value}
              onClick={() => {
                onSelect(value)
                setOpen(false)
              }}
              className={`outlook-dropdown-item ${selectedValue === value ? 'outlook-dropdown-item-active' : ''}`}
            >
              {renderOptionLeading?.(value)}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-3 h-3 rounded-sm border border-gray-300 shrink-0"
      style={{ backgroundColor: color }}
    />
  )
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

function AlignmentDropdown({ editor }: { editor: Editor }) {
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

function ColorDropdown({ editor }: { editor: Editor }) {
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

function FontFamilyDropdown({ editor }: { editor: Editor }) {
  const currentFamily = editor.getAttributes('textStyle').fontFamily as string | undefined

  return (
    <ComboDropdown
      buttonLabel="Font"
      listAriaLabel="Font families"
      options={FONT_FAMILIES}
      selectedValue={currentFamily ?? FONT_FAMILIES[0].value}
      isActive={currentFamily !== undefined}
      widthClass="min-w-[8.5rem]"
      onSelect={(value) => editor.chain().focus().setFontFamily(value).run()}
    />
  )
}

function FontSizeDropdown({ editor }: { editor: Editor }) {
  const currentSize = editor.getAttributes('textStyle').fontSize as string | undefined

  return (
    <ComboDropdown
      buttonLabel="Size"
      listAriaLabel="Font sizes"
      options={FONT_SIZES}
      selectedValue={currentSize ?? '11px'}
      widthClass="min-w-[3rem]"
      onSelect={(value) => editor.chain().focus().setFontSize(value).run()}
    />
  )
}

function getSelectedText(editor: Editor): string {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n')
}

function ClipboardGroup({ editor }: { editor: Editor }) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        editor.chain().focus().insertContent(text).run()
      }
    } catch {
      editor.chain().focus().run()
    }
  }

  const handleCopy = async () => {
    const text = getSelectedText(editor)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard unavailable
    }
  }

  const handleCut = async () => {
    const text = getSelectedText(editor)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      editor.chain().focus().deleteSelection().run()
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <>
      <ToolbarButton label="Paste" onClick={() => void handlePaste()}>
        <Icon><PasteIcon /></Icon>
      </ToolbarButton>
      <ToolbarButton label="Cut" onClick={() => void handleCut()}>
        <Icon><CutIcon /></Icon>
      </ToolbarButton>
      <ToolbarButton label="Copy" onClick={() => void handleCopy()}>
        <Icon><CopyIcon /></Icon>
      </ToolbarButton>
    </>
  )
}

function FindPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastIndexRef = useRef(0)

  useClickOutside(containerRef, open, () => setOpen(false))

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      lastIndexRef.current = 0
      setStatus('')
    }
  }, [open])

  const findNext = () => {
    const term = query.trim()
    if (!term) return

    const docText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', ' ')
    const start = lastIndexRef.current
    let index = docText.toLowerCase().indexOf(term.toLowerCase(), start)

    if (index === -1 && start > 0) {
      index = docText.toLowerCase().indexOf(term.toLowerCase(), 0)
    }

    if (index === -1) {
      setStatus('No results')
      return
    }

    let from = 0
    let to = 0
    let cursor = 0
    let found = false

    editor.state.doc.descendants((node, pos) => {
      if (found || !node.isText || !node.text) return

      const nodeStart = cursor
      const nodeEnd = cursor + node.text.length

      if (index >= nodeStart && index < nodeEnd) {
        const offset = index - nodeStart
        from = pos + offset
        to = from + term.length
        found = true
        return false
      }

      cursor = nodeEnd
    })

    if (found) {
      editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run()
      lastIndexRef.current = index + term.length
      setStatus('')
    } else {
      setStatus('No results')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <ToolbarButton label="Find" isActive={open} onClick={() => setOpen((prev) => !prev)}>
        <Icon><FindIcon /></Icon>
      </ToolbarButton>

      {open && (
        <div className="outlook-find-panel">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              lastIndexRef.current = 0
              setStatus('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                findNext()
              }
              if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder="Find in document"
            aria-label="Find in document"
            className="outlook-find-input"
          />
          <button type="button" onClick={findNext} className="outlook-find-next">
            Next
          </button>
          {status && <span className="outlook-find-status">{status}</span>}
        </div>
      )}
    </div>
  )
}

interface ToolbarProps {
  editor: Editor | null
  onToggleAgent: () => void
  onBack?: () => void
  showBack?: boolean
}

export default function Toolbar({ editor, onToggleAgent, onBack, showBack = true }: ToolbarProps) {
  if (!editor) return null

  return (
    <div className="outlook-ribbon">
      {showBack && onBack && (
        <>
          <ToolbarButton label="Back" onClick={onBack} className="outlook-back-btn">
            <Icon><BackIcon /></Icon>
            <span className="text-sm">Back</span>
          </ToolbarButton>
          <Divider />
        </>
      )}

      <ClipboardGroup editor={editor} />
      <Divider />

      <FontFamilyDropdown editor={editor} />
      <FontSizeDropdown editor={editor} />
      <Divider />

      <ToolbarButton label="Bold" isActive={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold text-sm">B</span>
      </ToolbarButton>
      <ToolbarButton label="Italic" isActive={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic text-sm">I</span>
      </ToolbarButton>
      <ToolbarButton label="Underline" isActive={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline text-sm">U</span>
      </ToolbarButton>
      <ColorDropdown editor={editor} />
      <Divider />

      <ToolbarButton
        label="Bullets"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <Icon><BulletListIcon /></Icon>
      </ToolbarButton>
      <AlignmentDropdown editor={editor} />
      <HeadingDropdown editor={editor} />
      <Divider />

      <FindPopover editor={editor} />

      <div className="flex-1" />

      <button type="button" onClick={onToggleAgent} className="outlook-agent-btn">
        +agent
      </button>
    </div>
  )
}
