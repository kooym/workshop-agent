import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { listTasksQuerySchema } from '@/lib/api/validators'

export async function GET(req: NextRequest) {
  const parsed = listTasksQuerySchema.safeParse({
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: tasks, error: tasksError } = await service
        .from('ax_tasks')
        .select('*')
        .eq('workshop_id', parsed.data.workshop_id)
        .order('order_index', { ascending: true })

      if (tasksError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, tasksError.message, 500)
      }

      return success(tasks ?? [])
    },
    { workshopId: parsed.data.workshop_id },
  )
}
