import type { NextRequest } from 'next/server'
import { withAdmin } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { z } from 'zod'

const changePasswordSchema = z.object({
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
})

export async function PATCH(req: NextRequest) {
  return withAdmin(req, async (_req, { user, service }) => {
    const body = await req.json().catch(() => null)
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, parsed.error.issues[0]?.message ?? '입력을 확인해주세요.', 400)
    }

    const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
      password: parsed.data.password,
    })

    if (updateError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
    }

    return success({ message: '비밀번호가 변경되었습니다.' })
  })
}
