'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Home() {
  const tickerText = 'BTK RDV  -  Planifiez votre visite en agence  -  Prenez votre ticket en ligne  -  Un accueil plus rapide, sans perte de temps.'
  const [showHours, setShowHours] = useState(false)
  const [openStatus, setOpenStatus] = useState<{ open: boolean | null; message: string }>({
    open: null,
    message: 'Verification du service',
  })

  useEffect(() => {
    const checkOpenStatus = async () => {
      try {
        const status = await fetch('/api/service-status', { cache: 'no-store' }).then(r => r.json())
        setOpenStatus({ open: Boolean(status.open), message: status.message || 'Service indisponible' })
      } catch {
        setOpenStatus({ open: false, message: 'Service indisponible' })
      }
    }

    checkOpenStatus()
    const timer = setInterval(checkOpenStatus, 30000)
    return () => clearInterval(timer)
  }, [])

  const serviceOpen = openStatus.open === true
  const serviceClosed = openStatus.open === false
  const disabledActionClass = 'cursor-not-allowed rounded-lg bg-gray-200 px-6 py-4 text-center text-base font-bold text-gray-400 shadow-sm'

  return (
    <main className={`flex min-h-screen flex-col lg:h-screen lg:overflow-hidden ${serviceClosed ? 'bg-gray-100' : 'bg-[#EEF7FF]'}`}>
      <header className="shrink-0 border-b border-blue-100 bg-white shadow-sm">
        <div className="mx-auto flex min-h-[72px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-5 lg:min-h-[78px] lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3 lg:gap-4">
            <img src="/BTK.png" alt="BTK" className="h-10 w-auto shrink-0 sm:h-12" />
            <div className="min-w-0">
              <div className="text-lg font-black leading-tight text-gray-950 sm:text-xl">BTK RDV</div>
              <div className="truncate text-xs font-medium text-gray-500 sm:text-sm">Moins d'attente, plus de confort.</div>
            </div>
          </Link>

          <div className="hidden items-center gap-3 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-btk-blue ring-1 ring-blue-100 md:flex">
            Service digital BTK
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href="https://www.btkbank.com/"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-bold text-btk-blue shadow-sm transition hover:bg-blue-50 lg:inline-flex"
            >
              A Propos
            </a>
            <a
              href="https://www.btkbank.com/site/fr/contact.php?id_article=38&objet=1"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-bold text-btk-blue shadow-sm transition hover:bg-blue-50 lg:inline-flex"
            >
              Contact
            </a>
            <button
              type="button"
              onClick={() => setShowHours(true)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-btk-blue shadow-sm transition hover:bg-blue-50 sm:px-4"
              aria-label="Afficher les horaires de travail"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Horaire</span>
            </button>
            <span className={`rounded-lg px-4 py-3 text-sm font-bold shadow-sm ring-1 sm:px-5 ${
              serviceOpen
                ? 'bg-green-50 text-green-700 ring-green-200'
                : serviceClosed
                  ? 'bg-red-50 text-red-700 ring-red-200'
                  : 'bg-gray-50 text-gray-500 ring-gray-200'
            }`}>
              {serviceOpen ? 'Service Ouvert' : serviceClosed ? 'Service fermé' : 'Verification...'}
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-8 px-5 py-8 sm:px-6 md:py-10 lg:min-h-0 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-4">
        <div className="min-w-0 text-center lg:text-left">
          <div className="mb-4 text-sm font-bold uppercase text-btk-blue">
            Bienvenue dans votre espace BTK RDV
          </div>

          <h1 className="font-gotu mx-auto max-w-3xl text-[2.25rem] font-normal leading-[1.16] text-gray-950 [word-spacing:4px] sm:text-[3.15rem] lg:mx-0 lg:text-[4.1rem]">
            <span className="block">Planifiez votre</span>
            <span className="block">visite en agence</span>
          </h1>

          <p className="font-gotu mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-700 sm:text-2xl lg:mx-0">
            Un accueil plus rapide, sans perte de temps.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            {serviceOpen ? (
              <>
                <Link
                  href="/client"
                  className="rounded-lg bg-btk-blue px-6 py-4 text-center text-base font-bold text-white shadow-sm transition hover:bg-btk-dark"
                >
                  Prendre un ticket
                </Link>
                <Link
                  href="/ecran"
                  className="rounded-lg border border-blue-100 bg-white px-6 py-4 text-center text-base font-bold text-btk-blue shadow-sm transition hover:bg-blue-50"
                >
                  Suivi en temps réel des guichets
                </Link>
              </>
            ) : (
              <>
                <span className={disabledActionClass}>Prendre un ticket</span>
                <span className={disabledActionClass}>Suivi en temps réel des guichets</span>
              </>
            )}
          </div>
        </div>

        <div className="flex min-h-0 items-center justify-center lg:h-full lg:justify-end">
          <img
            src="/rdv.png"
            alt="Planification de rendez-vous BTK"
            className="max-h-[280px] w-auto max-w-full object-contain sm:max-h-[360px] lg:h-full lg:max-h-[460px]"
          />
        </div>
      </section>

      <footer className="shrink-0 overflow-hidden border-t border-blue-100 bg-btk-blue py-3 text-white">
        <div className="ticker-track flex w-max whitespace-nowrap">
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-8 px-4 text-sm font-semibold uppercase">
              <span>{tickerText}</span>
              <span className="text-blue-200">|</span>
              <span>{tickerText}</span>
              <span className="text-blue-200">|</span>
            </div>
          ))}
        </div>
      </footer>

      {showHours && (
        <div className="fixed inset-0 z-50 flex justify-end bg-gray-950/35">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fermer les horaires"
            onClick={() => setShowHours(false)}
          />

          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-blue-100">
            <div className="flex items-center justify-between border-b border-blue-100 px-6 py-5">
              <div>
                <h2 className="mt-1 text-2xl font-black text-gray-950">Horaires de travail</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHours(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-100 text-xl font-black text-gray-500 transition hover:bg-blue-50 hover:text-btk-blue"
                aria-label="Fermer"
              >
                X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#F7FAFD] px-6 py-2">
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-blue-100">
                <div className="space-y-3">
                  {[
                    ['Lundi', 'De 08:00 - 16:30', true],
                    ['Mardi', 'De 08:00 - 16:30', true],
                    ['Mercredi', 'De 08:00 - 16:30', true],
                    ['Jeudi', 'De 08:00 - 16:30', true],
                    ['Vendredi', 'De 08:00 - 16:30', true],
                    ['Samedi', 'Fermé', false],
                    ['Dimanche', 'Fermé', false],
                  ].map(([day, hours, isOpen]) => (
                    <div
                      key={String(day)}
                      className={`flex items-center justify-between gap-4 rounded-lg px-4 py-2 ring-1 ${
                        isOpen
                          ? 'bg-green-50 text-green-900 ring-green-200'
                          : 'bg-red-50 text-red-900 ring-red-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-base font-black">{day}</div>
                        <div className={`mt-1 text-sm font-bold ${isOpen ? 'text-green-700' : 'text-red-700'}`}>
                          {hours}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase ring-1 ${
                        isOpen
                          ? 'bg-white text-green-700 ring-green-200'
                          : 'bg-white text-red-700 ring-red-200'
                      }`}>
                        {isOpen ? 'Ouvert' : 'Fermé'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
