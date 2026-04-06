'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/',        label: 'Dashboard', icon: HomeIcon },
  { href: '/play',    label: 'Play',      icon: PlayIcon },
  { href: '/preview', label: 'Preview',   icon: TelescopeIcon },
  { href: '/history', label: 'History',   icon: HistoryIcon },
  { href: '/sg',      label: 'SG',        icon: ChartIcon },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-16 items-end justify-around pb-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors ${
                active ? 'text-accent' : 'text-text-dim'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// ---- Inline SVG icons (no icon library dependency) ----

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12L12 3l9 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21V12h6v9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" strokeLinecap="round" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8l6 4-6 4V8z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.05 11a9 9 0 1 1 .5 4M3 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 20h18M5 20V10l5-5 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 21h8M12 17v4M6 3h12v7a6 6 0 0 1-12 0V3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 7H3a3 3 0 0 0 3 3M18 7h3a3 3 0 0 1-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TelescopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 7l4-3 10 4-4 3L3 7z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 11l4-3" strokeLinecap="round" />
      <path d="M10 11l2 5" strokeLinecap="round" />
      <path d="M8 16h6" strokeLinecap="round" />
    </svg>
  )
}
