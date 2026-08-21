interface BrandLogoProps {
  isDark?: boolean
  className?: string
}

export default function BrandLogo({ isDark = true, className = '' }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <img
        src="/agentdocs_logo_transparent.png"
        alt=""
        width={28}
        height={28}
        className={`h-7 w-7 object-contain ${isDark ? 'brightness-0 invert' : ''}`}
      />
      <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
        agentdocs
      </span>
    </span>
  )
}
