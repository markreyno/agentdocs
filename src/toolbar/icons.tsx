import type { ReactNode, SVGProps } from 'react'

export function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      {children}
    </span>
  )
}

export function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M10.5 3.5a.5.5 0 0 0-.7-.7L4.6 8l5.2 5.2a.5.5 0 1 0 .7-.7L6.2 8l4.3-4.5z" />
    </svg>
  )
}

export function ExportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M8.5 1.5a.5.5 0 0 0-1 0v7.793L5.354 7.146a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 9.293V1.5z" />
      <path d="M2.5 10.5a.5.5 0 0 0-1 0V13a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 14.5 13v-2.5a.5.5 0 0 0-1 0V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5v-2.5z" />
    </svg>
  )
}

export function WordFileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5L9.5 1zM9 2.2 12.3 5.5H9V2.2zM4 14V2h4v4h4v8H4z" />
      <path d="M5.2 7.2h1.1l.7 3.2.8-3.2h1.1l.8 3.2.7-3.2h1.1l-1.3 5.1H9.1L8.2 9l-.9 3.3H6.5L5.2 7.2z" />
    </svg>
  )
}

export function PdfFileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5L9.5 1zM9 2.2 12.3 5.5H9V2.2zM4 14V2h4v4h4v8H4z" />
      <path d="M5 8.2h1.6c.9 0 1.5.5 1.5 1.3 0 .8-.6 1.3-1.5 1.3H5.7V12H5V8.2zm.7.6v1.4h.8c.5 0 .8-.2.8-.7s-.3-.7-.8-.7H5.7zM9 8.2h1.3c1.1 0 1.8.7 1.8 1.9S11.4 12 10.3 12H9V8.2zm.7.6V11h.6c.7 0 1.1-.4 1.1-1.3s-.4-1.3-1.1-1.3h-.6z" />
    </svg>
  )
}

export function PasteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M11 2H9V1a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v1H1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM4 1h4v1H4V1zm7 12H1V3h1v1h8V3h1v10z" />
      <path d="M3 5h6v1H3V5zm0 2h6v1H3V7zm0 2h4v1H3V9z" />
    </svg>
  )
}

export function CutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M5.5 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM2 8l4.5-4.5L8 5l-1.5 1.5L8 8l-1.5 1.5L6.5 11 2 8zm3.5-2.5L3 8l2.5 2.5L8 8 5.5 5.5zM10.5 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    </svg>
  )
}

export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M4 2a2 2 0 0 0-2 2v8h8V4a2 2 0 0 0-2-2H4zm-1 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v7H3V4zm3 1h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  )
}

export function BulletListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <circle cx="2.5" cy="4" r="1" />
      <circle cx="2.5" cy="8" r="1" />
      <circle cx="2.5" cy="12" r="1" />
      <path d="M5 3.5h9v1H5v-1zm0 4h9v1H5v-1zm0 4h9v1H5v-1z" />
    </svg>
  )
}

export function FindIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242 1.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
    </svg>
  )
}

export function OutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M2 3.5a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.5zm2 4a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 4 7.5zm2 4a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 11.5z" />
    </svg>
  )
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-4.5a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 8 1.5zm0 11a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 8 12.5zM2.25 8A.75.75 0 0 1 3 7.25h1a.75.75 0 0 1 0 1.5H3A.75.75 0 0 1 2.25 8zm9 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 11.25 8zM3.72 3.72a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 1 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06zm6.8 6.8a.75.75 0 0 1 1.06 0l.7.7a.75.75 0 1 1-1.06 1.06l-.7-.7a.75.75 0 0 1 0-1.06zM12.28 3.72a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 1 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0zM5.48 10.52a.75.75 0 0 1 0 1.06l-.7.7a.75.75 0 1 1-1.06-1.06l.7-.7a.75.75 0 0 1 1.06 0z" />
    </svg>
  )
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M6.5 1.5a.75.75 0 0 1 .66.98A5.5 5.5 0 1 0 12.52 8.84a.75.75 0 0 1 1.4.54A7 7 0 1 1 5.98 1.16a.75.75 0 0 1 .52.34z" />
    </svg>
  )
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.292-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.292c.415.764-.42 1.6-1.185 1.184l-.292-.159a1.873 1.873 0 0 0-2.692 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.693-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.292A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
    </svg>
  )
}

export function AlignIcon({ align }: { align: string }) {
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

export function FontColorIcon({ color }: { color: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="font-semibold text-sm">A</span>
      <span className="w-4 h-[3px] rounded-sm mt-px" style={{ backgroundColor: color }} />
    </span>
  )
}

export function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-3 h-3 rounded-sm border border-gray-300 shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

export function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}

export function UndoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M6.354 2.146a.5.5 0 0 1 0 .708L4.207 5H10a4 4 0 1 1 0 8H5a.5.5 0 0 1 0-1h5a3 3 0 1 0 0-6H4.207l2.147 2.146a.5.5 0 1 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 0 1 .708 0z" />
    </svg>
  )
}

export function RedoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M9.646 2.146a.5.5 0 0 0 0 .708L11.793 5H6a4 4 0 1 0 0 8h5a.5.5 0 0 0 0-1H6a3 3 0 1 1 0-6h5.793L9.646 8.146a.5.5 0 1 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0z" />
    </svg>
  )
}

export function NumberedListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M5 3.5h9v1H5v-1zm0 4h9v1H5v-1zm0 4h9v1H5v-1z" />
      <text x="0.5" y="4.7" fontSize="4" fontFamily="sans-serif">1</text>
      <text x="0.5" y="8.7" fontSize="4" fontFamily="sans-serif">2</text>
      <text x="0.5" y="12.7" fontSize="4" fontFamily="sans-serif">3</text>
    </svg>
  )
}

export function BlockquoteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M3 3.5h1.5v3A2.5 2.5 0 0 1 2 9v-1a1.5 1.5 0 0 0 1.5-1.5H3v-3zm5.5 0H10v3A2.5 2.5 0 0 1 7.5 9v-1A1.5 1.5 0 0 0 9 6.5h-.5v-3z" />
      <path d="M3 11h10v1H3v-1zm0 2.5h7v1H3v-1z" />
    </svg>
  )
}

export function SceneBreakIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M2 7.5h3v1H2v-1zm4.5 0h3v1h-3v-1zM11 7.5h3v1h-3v-1z" />
    </svg>
  )
}

export function StrikeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M6.5 3c-1.6 0-2.8.9-2.8 2.2 0 1 .6 1.6 1.6 2h3.2c.7.2 1 .5 1 1 0 .7-.8 1.3-1.9 1.3-1.1 0-2-.5-2.3-1.3l-1 .4c.5 1.2 1.7 2 3.3 2 1.8 0 3-1 3-2.4 0-.6-.2-1.1-.6-1.5H12V6H2v.7h2.9c-.5-.4-.8-.9-.8-1.5 0-.8.8-1.4 1.9-1.4 1 0 1.8.5 2.1 1.2l1-.4C8.7 3.6 7.7 3 6.5 3z" />
    </svg>
  )
}

export function HighlightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M10.3 1.3a1 1 0 0 1 1.4 0l2 2a1 1 0 0 1 0 1.4L7.8 10.6l-3.4.7.7-3.4 5.2-5.2 .0-.4zM6.4 9.3l1.9 1.9-2.7.5.8-2.4z" />
      <path d="M2 13.5h12v1H2v-1z" />
    </svg>
  )
}

export function IndentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M2 3.5h12v1H2v-1zm5 3h7v1H7v-1zm0 3h7v1H7v-1zM2 12.5h12v1H2v-1zM2 6.3 5 8l-3 1.7V6.3z" />
    </svg>
  )
}

export function OutdentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M2 3.5h12v1H2v-1zm5 3h7v1H7v-1zm0 3h7v1H7v-1zM2 12.5h12v1H2v-1zM5 6.3v3.4L2 8l3-1.7z" />
    </svg>
  )
}

export function ClearFormatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M2.6 1.5h9.8v1.8H9.1L7.4 8.1h1.9l-.4 1.6H4.9l.4-1.6h1.9L8.9 3.3H4.4l-.5 1.6H2.2l.4-3.4z" />
      <path d="M2.1 12.4 12.4 2.1l.9.9L3 13.3z" />
    </svg>
  )
}

export function CodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M5.4 3.3 1 8l4.4 4.7 .9-.8L2.7 8l3.6-3.9-.9-.8zm5.2 0-.9.8L13.3 8l-3.6 3.9.9.8L15 8l-4.4-4.7z" />
    </svg>
  )
}

export function LineHeightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={16} height={16} {...props}>
      <path d="M6 2.5h8v1H6v-1zm0 4.5h8v1H6V7zm0 4.5h8v1H6v-1z" />
      <path d="M2.5 1.5 4.3 4H3.1v8H4.3l-1.8 2.5L.7 12H1.9V4H.7L2.5 1.5z" />
    </svg>
  )
}
