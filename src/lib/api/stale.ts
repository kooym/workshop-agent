import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { getStaleTargets, isStageAfter } from '@/lib/workshop/stage'
import type { WorkshopStage } from '@/types/workshop'

type StaleTable = 'clusters' | 'design_artifacts' | 'prds' | 'ax_reports'

export async function propagateStale(
  supabase: SupabaseClient<Database>,
  workshopId: string,
  modifiedStage: WorkshopStage,
): Promise<void> {
  const { data: workshop, error: workshopError } = await supabase
    .from('workshops')
    .select('current_stage')
    .eq('id', workshopId)
    .single()

  if (workshopError || !workshop || !isStageAfter(workshop.current_stage, modifiedStage)) {
    return
  }

  await Promise.all(
    getStaleTargets(modifiedStage).map((table) => dismissOrMarkStale(supabase, table, workshopId, true)),
  )
}

export async function dismissStale(
  supabase: SupabaseClient<Database>,
  workshopId: string,
  tables: StaleTable[],
): Promise<void> {
  await Promise.all(tables.map((table) => dismissOrMarkStale(supabase, table, workshopId, false)))
}

async function dismissOrMarkStale(
  supabase: SupabaseClient<Database>,
  table: StaleTable,
  workshopId: string,
  isStale: boolean,
) {
  await supabase.from(table).update({ is_stale: isStale }).eq('workshop_id', workshopId)
}
