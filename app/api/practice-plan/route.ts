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

  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(20)

  if (!rounds?.length) {
    return NextResponse.json({ plan: "Play some rounds first so I can tailor your practice plan to your game." })
  }

  const stats = calcStats(rounds)
  const bench = BENCHES[benchmark]

  // Calculate gaps vs benchmark
  const ottGap  = (stats.sgOtt  ?? bench.sg_ott)  - bench.sg_ott
  const appGap  = (stats.sgApp  ?? bench.sg_app)  - bench.sg_app
  const argGap  = (stats.sgArg  ?? bench.sg_arg)  - bench.sg_arg
  const puttGap = (stats.sgPutt ?? bench.sg_putt) - bench.sg_putt

  const prompt = `You are an expert golf coach creating a structured 60-minute practice session.

Player's SG gaps vs ${bench.label} benchmark (negative = below benchmark):
- Off the Tee: ${ottGap.toFixed(2)}
- Approach: ${appGap.toFixed(2)}
- Around Green: ${argGap.toFixed(2)}
- Putting: ${puttGap.toFixed(2)}

Additional context:
- GIR%: ${stats.girPct ?? 'N/A'}% (benchmark: ${bench.gir}%)
- Putts/Round: ${stats.puttsPerRound ?? 'N/A'} (benchmark: ${bench.puttsPerRound})

Create a specific 60-minute practice plan with 3-4 stations. For each station include:
- Time allocation
- Drill name
- Exact setup/instructions
- Success metric

Focus time proportionally on the biggest gaps. Format as a numbered list. Be specific — yardages, number of balls, distances. Total ≤ 200 words.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const plan = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ plan })
}
