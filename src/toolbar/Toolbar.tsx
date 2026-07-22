import { Editor } from '@tiptap/react'
import { isDesktopApp } from '../lib/isDesktop'
import { useTheme } from '../lib/theme'
import { AlignmentDropdown } from './AlignmentDropdown'
import { ClipboardGroup } from './ClipboardGroup'
import { ColorDropdown } from './ColorDropdown'
import { FindPopover } from './FindPopover'
import { FontFamilyDropdown, FontSizeDropdown } from './FontDropdowns'
import { HeadingDropdown } from './HeadingDropdown'
import { BackIcon, BulletListIcon, Icon, MoonIcon, SettingsIcon, SunIcon } from './icons'
import { OutlinePopover } from './OutlinePopover'
import { Divider, ToolbarButton } from './ToolbarButton'

interface ToolbarProps {
  editor: Editor | null
  onToggleAgent: () => void
  onOpenSettings?: () => void
  onBack?: () => void
  showBack?: boolean
  documentTitle?: string
  onDocumentTitleChange?: (title: string) => void
  onDocumentTitleBlur?: () => void
}

export default function Toolbar({
  editor,
  onToggleAgent,
  onOpenSettings,
  onBack,
  showBack = true,
  documentTitle,
  onDocumentTitleChange,
  onDocumentTitleBlur,
}: ToolbarProps) {
  const { theme, toggleTheme } = useTheme()
  const showDesktopControls = isDesktopApp()

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
      <OutlinePopover editor={editor} documentTitle={documentTitle} />

      {documentTitle !== undefined && onDocumentTitleChange && (
        <input
          type="text"
          value={documentTitle}
          onChange={(e) => onDocumentTitleChange(e.target.value)}
          onBlur={onDocumentTitleBlur}
          aria-label="Document title"
          className="doc-title-input"
          placeholder="Untitled document"
        />
      )}

      <div className="flex-1" />

      {showDesktopControls && onOpenSettings && (
        <ToolbarButton label="Settings" onClick={onOpenSettings}>
          <Icon><SettingsIcon /></Icon>
        </ToolbarButton>
      )}

      {showDesktopControls && (
        <ToolbarButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          <Icon>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</Icon>
        </ToolbarButton>
      )}

      <button type="button" onClick={onToggleAgent} className="outlook-agent-btn">
        +agent
      </button>
    </div>
  )
}
