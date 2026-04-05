import { createClient } from '@/lib/supabase/server'
import SGClient from '@/components/sg/SGClient'

export default async function SGPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: true })

  return <SGClient rounds={rounds ?? []} />
}
