import { Editor } from '@tiptap/react'
import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { HIGHLIGHT_COLOR, LINE_HEIGHTS } from './constants'
import {
  BlockquoteIcon,
  ClearFormatIcon,
  CodeIcon,
  HighlightIcon,
  Icon,
  IndentIcon,
  LineHeightIcon,
  MoreIcon,
  NumberedListIcon,
  OutdentIcon,
  RedoIcon,
  SceneBreakIcon,
  StrikeIcon,
  UndoIcon,
} from './icons'
import { ToolbarButton } from './ToolbarButton'
import { useClickOutside } from './useClickOutside'

/**
 * Overflow menu for editor commands that are already wired up in the
 * extension list but have no dedicated ribbon button yet. Flat list "for now"
 * rather than icons/submenus per tool - can be promoted to first-class ribbon
 * controls individually as they prove worth the ribbon space.
 */
export function MoreToolsDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, open, () => setOpen(false))

  const currentLineHeight = editor.getAttributes('textStyle').lineHeight as string | undefined
  const isHighlighted = editor.getAttributes('textStyle').backgroundColor === HIGHLIGHT_COLOR

  /**
   * Run the command on mousedown (TipTap toolbar pattern): preventDefault keeps
   * the editor selection, and doing the work here avoids relying on a follow-up
   * click that some browsers suppress after a canceled mousedown.
   */
  const runMenuAction = (event: ReactMouseEvent, fn: () => void) => {
    event.preventDefault()
    if ((event.currentTarget as HTMLButtonElement).disabled) return
    fn()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative${open ? ' outlook-dropdown-open' : ''}`}>
      <ToolbarButton label="More tools" isActive={open} onClick={() => setOpen((prev) => !prev)}>
        <Icon><MoreIcon /></Icon>
      </ToolbarButton>

      {open && (
        <div role="menu" aria-label="More formatting tools" className="outlook-dropdown outlook-dropdown--end">
          <button
            type="button"
            role="menuitem"
            disabled={!editor.can().undo()}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().undo().run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><UndoIcon /></Icon>
            Undo
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!editor.can().redo()}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().redo().run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><RedoIcon /></Icon>
            Redo
          </button>

          <div className="outlook-dropdown-divider" />

          <button
            type="button"
            role="menuitem"
            aria-pressed={editor.isActive('orderedList')}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().toggleOrderedList().run())}
            className={`outlook-dropdown-item ${editor.isActive('orderedList') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><NumberedListIcon /></Icon>
            Numbered list
          </button>
          <button
            type="button"
            role="menuitem"
            aria-pressed={editor.isActive('blockquote')}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().toggleBlockquote().run())}
            className={`outlook-dropdown-item ${editor.isActive('blockquote') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><BlockquoteIcon /></Icon>
            Blockquote
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().setHorizontalRule().run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><SceneBreakIcon /></Icon>
            Scene break
          </button>
          <button
            type="button"
            role="menuitem"
            aria-pressed={editor.isActive('strike')}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().toggleStrike().run())}
            className={`outlook-dropdown-item ${editor.isActive('strike') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><StrikeIcon /></Icon>
            Strikethrough
          </button>
          <button
            type="button"
            role="menuitem"
            aria-pressed={isHighlighted}
            onMouseDown={(e) =>
              runMenuAction(e, () => {
                if (isHighlighted) {
                  editor.chain().focus().unsetBackgroundColor().run()
                } else {
                  editor.chain().focus().setBackgroundColor(HIGHLIGHT_COLOR).run()
                }
              })
            }
            className={`outlook-dropdown-item ${isHighlighted ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><HighlightIcon /></Icon>
            Highlight
          </button>
          <button
            type="button"
            role="menuitem"
            aria-pressed={editor.isActive('codeBlock')}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().toggleCodeBlock().run())}
            className={`outlook-dropdown-item ${editor.isActive('codeBlock') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><CodeIcon /></Icon>
            Code block
          </button>

          <div className="outlook-dropdown-divider" />

          <button
            type="button"
            role="menuitem"
            disabled={!editor.can().sinkListItem('listItem')}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().sinkListItem('listItem').run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><IndentIcon /></Icon>
            Indent
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!editor.can().liftListItem('listItem')}
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().liftListItem('listItem').run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><OutdentIcon /></Icon>
            Outdent
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().unsetAllMarks().run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><ClearFormatIcon /></Icon>
            Clear formatting
          </button>

          <div className="outlook-dropdown-divider" />
          <div className="outlook-dropdown-section-label">Line spacing</div>
          {LINE_HEIGHTS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              role="menuitem"
              aria-pressed={currentLineHeight === value}
              onMouseDown={(e) => runMenuAction(e, () => editor.chain().focus().setLineHeight(value).run())}
              className={`outlook-dropdown-item ${currentLineHeight === value ? 'outlook-dropdown-item-active' : ''}`}
            >
              <Icon size={14}><LineHeightIcon /></Icon>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
