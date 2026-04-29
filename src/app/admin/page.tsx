import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  if (user.user_metadata?.role !== 'admin') {
    redirect('/dashboard')
  }

  return <AdminDashboard />
}
