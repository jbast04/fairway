'use client'

import { useState, useRef, useEffect } from 'react'
import type { CourseSearchResult } from '@/types'
import COURSE_DB from '@/lib/courses.json'

interface CourseEntry {
  name: string
  city: string
  state: string
  lat: number
  lng: number
  par: number[]
  rating: number
  slope: number
}

interface Props {
  onSelect: (course: CourseSearchResult & { par: number[]; rating: number; slope: number }) => void
  onClose: () => void
}

// Fuzzy search — exact port of HTML's searchCourses()
function searchCourses(q: string): CourseEntry[] {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(t => t.length > 1)
  if (!terms.length) return []

  return (COURSE_DB as CourseEntry[])
    .map(c => {
      const hay = `${c.name} ${c.city} ${c.state || ''}`.toLowerCase()
      let score = 0
      for (const t of terms) {
        if (c.name.toLowerCase().includes(t)) score += 10
        if (c.city.toLowerCase().includes(t)) score += 4
        if ((c.state || '').toLowerCase() === t) score += 2
        if (hay.includes(t)) score += 1
      }
      return { c, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.c)
}

export default function CourseSearchModal({ onSelect, onClose }: Props) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<CourseEntry[]>([])
  const inputRef              = useRef<HTMLInputElement>(null)
  const timerRef              = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleInput(q: string) {
    setQuery(q)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (q.length < 2) { setResults([]); return }
      setResults(searchCourses(q).slice(0, 15))
    }, 180)
  }

  function handleSelect(c: CourseEntry) {
    const totalPar = c.par.reduce((a, b) => a + b, 0)
    onSelect({
      id: `${c.name}-${c.city}`.replace(/\s+/g, '-').toLowerCase(),
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      city: c.city,
      state: c.state,
      par: c.par,
      rating: c.rating,
      slope: c.slope,
    })
  }

  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button onClick={onClose} className="text-text-dim">✕</button>
        <h2 className="text-base font-semibold text-text">Find Course</h2>
      </div>

      {/* Search bar */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
          <span className="text-base">⛳</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="e.g. Pebble Beach, Bethpage Black…"
            className="flex-1 bg-transparent text-sm text-text placeholder-text-dim focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }} className="text-text-dim">✕</button>
          )}
        </div>
      </div>

      {/* Initial hint */}
      {!query && (
        <div className="px-4">
          <p className="text-xs text-text-dim">
            Search 95 famous courses instantly — try: pebble, augusta, bethpage, sawgrass, torrey, bandon…
          </p>
        </div>
      )}

      {/* No results */}
      {query.length >= 2 && results.length === 0 && (
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-text-dim">
            No matches. Try shorter terms like "pebble", "bethpage", "sawgrass".
          </p>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mt-2 space-y-2">
          {results.map((course, i) => {
            const totalPar = course.par.reduce((a, b) => a + b, 0)
            const front = course.par.slice(0, 9).join(' ')
            const back  = course.par.slice(9).join(' ')
            return (
              <button
                key={i}
                onClick={() => handleSelect(course)}
                className="w-full rounded-xl border border-border bg-surface p-3 text-left transition-colors active:bg-surface-2"
              >
                <p className="text-sm font-semibold text-text">{course.name}</p>
                <p className="mt-0.5 text-xs text-text-dim">
                  {course.city}, {course.state} · Par {totalPar} · {course.rating}/{course.slope}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-text-dim">
                  {front} | {back}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
