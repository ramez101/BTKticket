import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BTK Easy - BTK Bank',
  description: 'Gestion de tickets en ligne - BTK Bank',
  icons: {
    icon: '/BTK.png',
    shortcut: '/BTK.png',
    apple: '/BTK.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
