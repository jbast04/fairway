'use client'

import { useState } from 'react'
import type { Round, BagClub, Profile, BenchmarkKey } from '@/types'
import { calcHandicapIndex } from '@/lib/handicap'
import PracticePlanner from './PracticePlanner'
import BagManager from './BagManager'
import HandicapTracker from './HandicapTracker'

interface Props {
  rounds: Round[]
  bag: BagClub[]
  profile: Profile | null
  userId: string
}

type Tab = 'practice' | 'bag' | 'handicap'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'practice',  label: 'Practice',  icon: '🎯' },
  { key: 'bag',       label: 'My Bag',    icon: '🏌️' },
  { key: 'handicap',  label: 'Handicap',  icon: '📊' },
]

export default function ImproveClient({ rounds, bag, profile, userId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('practice')
  const handicapIndex = calcHandicapIndex(rounds)

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-text">Improve</h1>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
              activeTab === t.key
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-dim'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {activeTab === 'practice' && (
          <PracticePlanner rounds={rounds} />
        )}
        {activeTab === 'bag' && (
          <BagManager initialBag={bag} userId={userId} />
        )}
        {activeTab === 'handicap' && (
          <HandicapTracker
            rounds={rounds}
            handicapIndex={handicapIndex}
            profile={profile}
          />
        )}
      </div>
    </div>
  )
}
