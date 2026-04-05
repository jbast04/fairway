'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Round } from '@/types'

interface Props {
  rounds: Round[]
}

export default function ScoreTrendChart({ rounds }: Props) {
  const data = [...rounds]
    .reverse()
    .slice(-15)
    .map(r => ({
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: r.score,
      par: r.par,
      delta: r.score !== null ? r.score - r.par : null,
    }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: '#8aaa92', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#8aaa92', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => (v >= 0 ? `+${v}` : `${v}`)}
        />
        <Tooltip
          contentStyle={{ background: '#0d1a0f', border: '1px solid #1f3324', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#8aaa92' }}
          itemStyle={{ color: '#4ade80' }}
          formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v}`, 'vs Par']}
        />
        <ReferenceLine y={0} stroke="#1f3324" strokeDasharray="3 3" />
        <Line
          type="monotone"
          dataKey="delta"
          stroke="#4ade80"
          strokeWidth={2}
          dot={{ fill: '#4ade80', r: 3 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
