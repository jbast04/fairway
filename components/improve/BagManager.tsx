'use client'

import { useState } from 'react'
import type { BagClub } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  initialBag: BagClub[]
  userId: string
}

const DEFAULT_CLUBS = [
  'Driver', '3-wood', '5-wood', '4-iron', '5-iron', '6-iron',
  '7-iron', '8-iron', '9-iron', 'PW', 'GW', 'SW', 'LW', 'Putter',
]

export default function BagManager({ initialBag, userId }: Props) {
  const [bag, setBag]         = useState<BagClub[]>(initialBag)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm]       = useState({ avg: '', carry: '', max: '' })
  const [saving, setSaving]   = useState(false)

  const supabase = createClient()

  async function addDefaultClub(name: string) {
    const { data, error } = await supabase
      .from('bag')
      .insert({
        user_id: userId,
        club_name: name,
        sort_order: bag.length,
      })
      .select()
      .single()
    if (data) setBag(b => [...b, data])
  }

  async function saveClub(club: BagClub) {
    setSaving(true)
    const updates = {
      avg_distance:   form.avg   ? parseInt(form.avg)   : club.avg_distance,
      carry_distance: form.carry ? parseInt(form.carry) : club.carry_distance,
      max_distance:   form.max   ? parseInt(form.max)   : club.max_distance,
    }
    const { data } = await supabase
      .from('bag')
      .update(updates)
      .eq('id', club.id)
      .select()
      .single()

    if (data) setBag(b => b.map(c => c.id === club.id ? data : c))
    setEditing(null)
    setSaving(false)
  }

  async function deleteClub(id: string) {
    await supabase.from('bag').delete().eq('id', id)
    setBag(b => b.filter(c => c.id !== id))
  }

  const bagClubNames = new Set(bag.map(c => c.club_name))
  const missingClubs = DEFAULT_CLUBS.filter(c => !bagClubNames.has(c))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-text">My Bag</h2>
        <p className="mt-0.5 text-xs text-text-dim">Track your club distances.</p>
      </div>

      {/* Existing clubs */}
      <div className="space-y-2">
        {bag.map(club => (
          <div key={club.id} className="rounded-xl border border-border bg-surface">
            {editing === club.id ? (
              <div className="p-3 space-y-2">
                <p className="text-sm font-semibold text-text">{club.club_name}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'avg',   label: 'Avg' },
                    { key: 'carry', label: 'Carry' },
                    { key: 'max',   label: 'Max' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] text-text-dim">{f.label} (yds)</label>
                      <input
                        type="number"
                        value={form[f.key as keyof typeof form]}
                        onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                        placeholder={(club as any)[`${f.key === 'avg' ? 'avg' : f.key}_distance`]?.toString() ?? '—'}
                        className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveClub(club)}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-accent py-2 text-xs font-semibold text-bg disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="flex-1 rounded-lg border border-border py-2 text-xs text-text-dim"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditing(club.id)
                  setForm({
                    avg:   club.avg_distance?.toString() ?? '',
                    carry: club.carry_distance?.toString() ?? '',
                    max:   club.max_distance?.toString() ?? '',
                  })
                }}
                className="flex w-full items-center justify-between p-3"
              >
                <p className="text-sm font-semibold text-text">{club.club_name}</p>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-text-dim">Avg / Carry / Max</p>
                    <p className="text-xs font-medium text-text">
                      {club.avg_distance ?? '—'} / {club.carry_distance ?? '—'} / {club.max_distance ?? '—'}y
                    </p>
                  </div>
                  <span className="text-text-dim">›</span>
                </div>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add missing clubs */}
      {missingClubs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-text-dim">Add clubs</p>
          <div className="flex flex-wrap gap-2">
            {missingClubs.map(c => (
              <button
                key={c}
                onClick={() => addDefaultClub(c)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim transition-colors active:border-accent active:text-accent"
              >
                + {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
