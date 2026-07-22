import type { MouseEvent as ReactMouseEvent } from 'react'

export function keepEditorSelection(event: ReactMouseEvent) {
  event.preventDefault()
}
