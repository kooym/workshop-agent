import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerClient()
  const { error: authError } = await supabase.auth.signOut()

  if (authError) {
    return error(API_ERROR_CODES.INTERNAL_ERROR, authError.message, 500)
  }

  return success({ success: true })
}
