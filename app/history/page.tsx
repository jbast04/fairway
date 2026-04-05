import { createClient } from '@/lib/supabase/server'
import HistoryClient from '@/components/history/HistoryClient'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: false })

  return <HistoryClient rounds={rounds ?? []} />
}
