import { createClient } from '@/lib/supabase/server'
import ImproveClient from '@/components/improve/ImproveClient'

export default async function ImprovePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [roundsRes, bagRes, profileRes] = await Promise.all([
    supabase
      .from('rounds')
      .select('*')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .limit(20),
    supabase
      .from('bag')
      .select('*')
      .eq('user_id', user!.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single(),
  ])

  return (
    <ImproveClient
      rounds={roundsRes.data ?? []}
      bag={bagRes.data ?? []}
      profile={profileRes.data}
      userId={user!.id}
    />
  )
}
