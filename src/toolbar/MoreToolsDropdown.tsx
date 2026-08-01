import { Editor } from '@tiptap/react'
import { useRef, useState } from 'react'
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
import { keepEditorSelection } from './keepEditorSelection'
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

  const runAndClose = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <ToolbarButton label="More tools" isActive={open} onClick={() => setOpen((prev) => !prev)}>
        <Icon><MoreIcon /></Icon>
      </ToolbarButton>

      {open && (
        <div role="menu" aria-label="More formatting tools" className="outlook-dropdown">
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            disabled={!editor.can().undo()}
            onClick={() => runAndClose(() => editor.chain().focus().undo().run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><UndoIcon /></Icon>
            Undo
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            disabled={!editor.can().redo()}
            onClick={() => runAndClose(() => editor.chain().focus().redo().run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><RedoIcon /></Icon>
            Redo
          </button>

          <div className="outlook-dropdown-divider" />

          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            aria-pressed={editor.isActive('orderedList')}
            onClick={() => runAndClose(() => editor.chain().focus().toggleOrderedList().run())}
            className={`outlook-dropdown-item ${editor.isActive('orderedList') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><NumberedListIcon /></Icon>
            Numbered list
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            aria-pressed={editor.isActive('blockquote')}
            onClick={() => runAndClose(() => editor.chain().focus().toggleBlockquote().run())}
            className={`outlook-dropdown-item ${editor.isActive('blockquote') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><BlockquoteIcon /></Icon>
            Blockquote
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            onClick={() => runAndClose(() => editor.chain().focus().setHorizontalRule().run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><SceneBreakIcon /></Icon>
            Scene break
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            aria-pressed={editor.isActive('strike')}
            onClick={() => runAndClose(() => editor.chain().focus().toggleStrike().run())}
            className={`outlook-dropdown-item ${editor.isActive('strike') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><StrikeIcon /></Icon>
            Strikethrough
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            aria-pressed={isHighlighted}
            onClick={() =>
              runAndClose(() => {
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
            onMouseDown={keepEditorSelection}
            aria-pressed={editor.isActive('codeBlock')}
            onClick={() => runAndClose(() => editor.chain().focus().toggleCodeBlock().run())}
            className={`outlook-dropdown-item ${editor.isActive('codeBlock') ? 'outlook-dropdown-item-active' : ''}`}
          >
            <Icon size={14}><CodeIcon /></Icon>
            Code block
          </button>

          <div className="outlook-dropdown-divider" />

          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            disabled={!editor.can().sinkListItem('listItem')}
            onClick={() => runAndClose(() => editor.chain().focus().sinkListItem('listItem').run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><IndentIcon /></Icon>
            Indent
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            disabled={!editor.can().liftListItem('listItem')}
            onClick={() => runAndClose(() => editor.chain().focus().liftListItem('listItem').run())}
            className="outlook-dropdown-item"
          >
            <Icon size={14}><OutdentIcon /></Icon>
            Outdent
          </button>
          <button
            type="button"
            role="menuitem"
            onMouseDown={keepEditorSelection}
            onClick={() => runAndClose(() => editor.chain().focus().unsetAllMarks().run())}
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
              onMouseDown={keepEditorSelection}
              aria-pressed={currentLineHeight === value}
              onClick={() => runAndClose(() => editor.chain().focus().setLineHeight(value).run())}
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
