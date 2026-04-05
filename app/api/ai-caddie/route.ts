import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { calcStats } from '@/lib/stats'
import { BENCHES } from '@/lib/benchmarks'
import type { BenchmarkKey } from '@/types'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { benchmark = '10hcp' } = (await req.json()) as { benchmark?: BenchmarkKey }

  // Fetch last 20 rounds
  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(20)

  if (!rounds?.length) {
    return NextResponse.json({ analysis: "Play a few rounds first and I'll have some insights for you!" })
  }

  const stats = calcStats(rounds)
  const bench = BENCHES[benchmark]

  const prompt = `You are an expert golf coach analyzing a player's performance data. Provide concise, actionable coaching insights.

Player Stats (last ${rounds.length} rounds):
- Scoring Average: ${stats.scoringAvg ?? 'N/A'}
- Best Score: ${stats.bestScore ?? 'N/A'}
- GIR%: ${stats.girPct ?? 'N/A'}%
- FIR%: ${stats.firPct ?? 'N/A'}%
- Putts/Round: ${stats.puttsPerRound ?? 'N/A'}
- 3-Putt Avg: ${stats.threePuttAvg ?? 'N/A'}

Strokes Gained vs ${bench.label} Benchmark:
- Off the Tee: ${stats.sgOtt?.toFixed(2) ?? 'N/A'} (benchmark: ${bench.sg_ott})
- Approach: ${stats.sgApp?.toFixed(2) ?? 'N/A'} (benchmark: ${bench.sg_app})
- Around Green: ${stats.sgArg?.toFixed(2) ?? 'N/A'} (benchmark: ${bench.sg_arg})
- Putting: ${stats.sgPutt?.toFixed(2) ?? 'N/A'} (benchmark: ${bench.sg_putt})

Provide:
1. The single biggest opportunity (1-2 sentences)
2. The player's clearest strength (1 sentence)
3. One specific drill or practice focus for this week (2-3 sentences)

Keep the entire response under 150 words. Be specific and encouraging.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const analysis = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ analysis })
}
