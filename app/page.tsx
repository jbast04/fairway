import { createClient } from '@/lib/supabase/server'
import { calcStats } from '@/lib/stats'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: false })
    .limit(30)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const stats = calcStats(rounds ?? [])

  return (
    <DashboardClient
      stats={stats}
      rounds={rounds ?? []}
      profile={profile}
    />
  )
}
