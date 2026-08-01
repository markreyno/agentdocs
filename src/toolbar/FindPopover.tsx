import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { FindIcon, Icon } from './icons'
import { ToolbarButton } from './ToolbarButton'
import { useClickOutside } from './useClickOutside'

/**
 * Flattens the doc's text nodes into a single searchable string, tracking the
 * real ProseMirror position behind every character (including a synthetic '\n'
 * separator inserted between adjacent blocks, whose own position doesn't
 * matter since a search term can't legitimately contain a newline).
 */
function buildSearchIndex(editor: Editor): { text: string; positions: number[] } {
  const chars: string[] = []
  const positions: number[] = []
  let prevEnd: number | null = null

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    if (prevEnd !== null && pos !== prevEnd) {
      chars.push('\n')
      positions.push(pos)
    }
    for (let i = 0; i < node.text.length; i++) {
      chars.push(node.text[i])
      positions.push(pos + i)
    }
    prevEnd = pos + node.text.length
  })

  return { text: chars.join(''), positions }
}

export function FindPopover({ editor }: { editor: Editor }) {
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

    const { text: docText, positions } = buildSearchIndex(editor)
    const start = lastIndexRef.current
    let index = docText.toLowerCase().indexOf(term.toLowerCase(), start)

    if (index === -1 && start > 0) {
      index = docText.toLowerCase().indexOf(term.toLowerCase(), 0)
    }

    if (index === -1) {
      setStatus('No results')
      return
    }

    const from = positions[index]
    const to = positions[index + term.length - 1] + 1

    editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run()
    lastIndexRef.current = index + term.length
    setStatus('')
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
