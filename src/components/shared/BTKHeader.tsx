'use client'
import Link from 'next/link'

interface BTKHeaderProps {
  title: string
  subtitle?: string
  agencyName?: string
  right?: React.ReactNode
  showBack?: boolean
}

export default function BTKHeader({ title, subtitle, agencyName, right, showBack }: BTKHeaderProps) {
  return (
    <header className="bg-btk-blue text-white px-4 py-3 flex items-center gap-3 shadow-md">
      {showBack && (
        <Link href="/" className="text-white/70 hover:text-white transition-colors mr-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
      )}
      <div className="bg-white rounded-lg w-9 h-9 flex items-center justify-center shrink-0">
        <span className="text-btk-blue font-bold text-xs leading-none">BTK</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-tight">{title}</div>
        {(subtitle || agencyName) && (
          <div className="text-blue-200 text-xs truncate">{agencyName || subtitle}</div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  )
}
