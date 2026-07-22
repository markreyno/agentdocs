import { Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { FindIcon, Icon } from './icons'
import { ToolbarButton } from './ToolbarButton'
import { useClickOutside } from './useClickOutside'

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
