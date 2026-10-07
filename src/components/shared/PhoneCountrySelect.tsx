'use client'

import { useMemo, useRef, useState } from 'react'
import { PHONE_COUNTRIES } from '@/lib/phone-countries'

export function PhoneCountrySelect({ value, onChange, className = '' }: { value: string; onChange: (countryCode: string) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [openUpward, setOpenUpward] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = PHONE_COUNTRIES.find(country => country.code === value) ?? PHONE_COUNTRIES[0]
  const countries = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('fr')
    return search ? PHONE_COUNTRIES.filter(country => `${country.name} ${country.dial} ${country.code}`.toLocaleLowerCase('fr').includes(search)) : PHONE_COUNTRIES
  }, [query])

  const toggleDropdown = () => {
    if (!open && triggerRef.current) {
      const bounds = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = 340
      setOpenUpward(bounds.bottom + dropdownHeight > window.innerHeight && bounds.top > dropdownHeight)
    }
    setOpen(current => !current)
  }

  return <div className={`relative ${className}`}>
    <button ref={triggerRef} type="button" onClick={toggleDropdown} className="relative flex h-full w-full items-center gap-2 bg-[#f4fbff] px-3 py-3 pr-10 text-left text-sm font-black text-[#0065a1] hover:bg-white" aria-expanded={open}>
      <img src={`https://flagcdn.com/w40/${selected.code.toLowerCase()}.png`} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm" />
      <span className="shrink-0">{selected.code}</span>
      <span className="text-[#0065a1]/35">|</span>
      <span className="shrink-0">{selected.dial}</span>
      <span className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </span>
    </button>
    {open && <div className={`absolute left-0 z-[70] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#dbeaf8] bg-white shadow-[0_24px_60px_-28px_rgba(0,101,161,0.35)] ${openUpward ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]'}`}>
      <div className="border-b border-[#dbeaf8] p-3"><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un pays ou un indicatif" className="w-full rounded-xl border border-[#dbeaf8] bg-[#f4fbff] px-3 py-2 text-sm font-semibold text-[#003a66] outline-none focus:border-[#0065a1]" /></div>
      <div className="max-h-64 overflow-y-auto p-2">{countries.map(country => <button key={country.code} type="button" onClick={() => { onChange(country.code); setOpen(false); setQuery('') }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${country.code === selected.code ? 'bg-[#e4f2ff] text-[#0065a1]' : 'text-[#003a66] hover:bg-[#f4fbff]'}`}>
        <img src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm" loading="lazy" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{country.name}</span><span className="text-sm font-black">{country.dial}</span>
      </button>)}</div>
    </div>}
  </div>
}
