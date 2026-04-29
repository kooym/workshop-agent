import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { z } from 'zod'

const updateUserSchema = z.object({
  approved: z.boolean(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAdmin(req, async (_req, { user: adminUser, service }) => {
    const { id: targetUserId } = await params

    // Prevent admin from deactivating themselves
    if (targetUserId === adminUser.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '자신의 계정은 비활성화할 수 없습니다.', 403)
    }

    const body = await req.json().catch(() => null)
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, 'approved 값을 확인해주세요.', 400)
    }

    const { error: updateError } = await service.auth.admin.updateUserById(targetUserId, {
      user_metadata: { approved: parsed.data.approved },
    })

    if (updateError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
    }

    return success({ id: targetUserId, approved: parsed.data.approved })
  })
}
