import type { ReactNode } from 'react'
import { keepEditorSelection } from './keepEditorSelection'

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  label: string
  children: ReactNode
  className?: string
}

export function ToolbarButton({ onClick, isActive = false, disabled = false, label, children, className = '' }: ToolbarButtonProps) {
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

export function Divider() {
  return <div className="outlook-divider" />
}
