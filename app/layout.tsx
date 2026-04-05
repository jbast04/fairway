import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/ui/BottomNav'

export const metadata: Metadata = {
  title: 'Fairway',
  description: 'Golf performance analytics',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Fairway',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#07100a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text antialiased">
        {/* Main content sits above the bottom nav */}
        <main className="pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
