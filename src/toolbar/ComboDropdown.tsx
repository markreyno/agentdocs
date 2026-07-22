import { useRef, useState, type ReactNode } from 'react'
import { keepEditorSelection } from './keepEditorSelection'
import { useClickOutside } from './useClickOutside'

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

export function ComboDropdown({
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
