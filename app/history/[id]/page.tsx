import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RoundDetailClient from '@/components/history/RoundDetailClient'

export default async function RoundDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single()

  if (!round) notFound()

  const { data: shots } = await supabase
    .from('shots')
    .select('*')
    .eq('round_id', params.id)
    .order('hole_number', { ascending: true })
    .order('shot_number', { ascending: true })

  const { data: holes } = await supabase
    .from('holes')
    .select('*')
    .eq('round_id', params.id)
    .order('hole_number', { ascending: true })

  return (
    <RoundDetailClient
      round={round}
      shots={shots ?? []}
      holes={holes ?? []}
    />
  )
}
