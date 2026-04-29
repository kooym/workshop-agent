import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { success } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  return withAdmin(req, async (_req, { service }) => {
    const { data: { users }, error: listError } = await service.auth.admin.listUsers()

    if (listError) {
      throw listError
    }

    const mapped = users.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      name: (u.user_metadata?.name as string) ?? '',
      role: (u.user_metadata?.role as string) ?? 'facilitator',
      approved: u.user_metadata?.approved === true,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))

    return success({ users: mapped })
  })
}
