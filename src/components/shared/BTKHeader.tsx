'use client'
import Link from 'next/link'

interface BTKHeaderProps {
  subtitle?: string
  agencyName?: string
  right?: React.ReactNode
  showBack?: boolean
  leftAddon?: React.ReactNode
}

export default function BTKHeader({ subtitle, agencyName, right, showBack, leftAddon }: BTKHeaderProps) {
  return (
    <header className="btk-header shrink-0">
      <div className="btk-header-inner mx-auto flex h-full w-full max-w-[1500px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="btk-header-leading flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {showBack && (
            <Link href="/" className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-btk-blue transition hover:bg-btk-bg" aria-label="Retour à l'accueil">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </Link>
          )}
          {leftAddon}
          <Link href="/" className="btk-brand flex min-w-0 items-center gap-3" aria-label="BTK Easy - Accueil">
            <span className="btk-brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
              <img src="/BTK.png" alt="Logo BTK" className="h-8 w-auto" />
            </span>
            <span className="btk-brand-copy min-w-0">
              <span className="block text-lg font-black leading-tight text-[#102746]">BTK Easy</span>
              {(agencyName || subtitle) && (
                <span className="block truncate text-xs font-medium text-slate-500">{agencyName || subtitle}</span>
              )}
            </span>
          </Link>
        </div>
        {right && <div className="btk-header-actions flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">{right}</div>}
      </div>
    </header>
  )
}
