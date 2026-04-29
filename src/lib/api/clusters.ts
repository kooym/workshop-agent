import { propagateStale } from '@/lib/api/stale'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'
import type { ClusteringResponse } from '@/lib/ai/schemas'
import type { ExistingClusterPromptInput } from '@/lib/ai/prompts'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export type ClusterWithNotes = Tables<'clusters'> & {
  notes: Tables<'notes'>[]
}

const PROCESSING_STALE_MS = 5 * 60 * 1000

export function isProcessingStale(isProcessingSince: string | null, now = new Date()) {
  if (!isProcessingSince) {
    return false
  }

  const startedAt = Date.parse(isProcessingSince)
  if (Number.isNaN(startedAt)) {
    return true
  }

  return now.getTime() - startedAt > PROCESSING_STALE_MS
}

export async function getClustersWithNotes(
  service: ServiceClient,
  workshopId: string,
): Promise<ClusterWithNotes[]> {
  const [clustersResult, notesResult] = await Promise.all([
    service
      .from('clusters')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('order_index', { ascending: true }),
    service
      .from('notes')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: true }),
  ])

  if (clustersResult.error) {
    throw new Error(clustersResult.error.message)
  }
  if (notesResult.error) {
    throw new Error(notesResult.error.message)
  }

  const notes = notesResult.data ?? []
  return (clustersResult.data ?? []).map((cluster) => ({
    ...cluster,
    notes: notes.filter((note) => note.cluster_id === cluster.id),
  }))
}

export function buildExistingClusterPromptInput(
  clusters: Tables<'clusters'>[],
  notes: Tables<'notes'>[],
): ExistingClusterPromptInput[] {
  return clusters.map((cluster) => ({
    id: cluster.id,
    name: cluster.name,
    summary: cluster.summary,
    note_ids: notes.filter((note) => note.cluster_id === cluster.id).map((note) => note.id),
  }))
}

export async function applyClusteringResponse({
  service,
  workshopId,
  response,
  existingClusters,
  fullRefresh,
}: {
  service: ServiceClient
  workshopId: string
  response: ClusteringResponse
  existingClusters: Tables<'clusters'>[]
  fullRefresh: boolean
}) {
  const clusterIdsByIndex = new Map<number, string>()

  if (fullRefresh) {
    const { error: deleteError } = await service
      .from('clusters')
      .delete()
      .eq('workshop_id', workshopId)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    const rows = response.clusters.map((cluster, index) => {
      const id = crypto.randomUUID()
      clusterIdsByIndex.set(index, id)
      const summary = cluster.rationale
        ? `${cluster.summary} | ${cluster.rationale}`
        : cluster.summary
      return {
        id,
        workshop_id: workshopId,
        name: cluster.name,
        summary,
        order_index: index,
        is_stale: false,
      }
    })

    const { error: insertError } = await service.from('clusters').insert(rows)
    if (insertError) {
      throw new Error(insertError.message)
    }
  } else {
    const existingByName = new Map(
      existingClusters.map((cluster) => [normalizeClusterName(cluster.name), cluster]),
    )
    const maxOrderIndex = existingClusters.reduce(
      (max, cluster) => Math.max(max, cluster.order_index),
      -1,
    )
    const newRows: Tables<'clusters'>[] = []

    response.clusters.forEach((cluster, index) => {
      const existing = existingByName.get(normalizeClusterName(cluster.name))
      if (existing) {
        clusterIdsByIndex.set(index, existing.id)
        return
      }

      const id = crypto.randomUUID()
      clusterIdsByIndex.set(index, id)
      const summary = cluster.rationale
        ? `${cluster.summary} | ${cluster.rationale}`
        : cluster.summary
      newRows.push({
        id,
        workshop_id: workshopId,
        name: cluster.name,
        summary,
        order_index: maxOrderIndex + newRows.length + 1,
        is_stale: false,
        score_impact: null,
        score_feasibility: null,
        score_urgency: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    })

    if (newRows.length) {
      const { error: insertError } = await service.from('clusters').insert(newRows)
      if (insertError) {
        throw new Error(insertError.message)
      }
    }
  }

  await Promise.all(
    response.clusters.map(async (cluster, index) => {
      const clusterId = clusterIdsByIndex.get(index)
      if (!clusterId || cluster.note_ids.length === 0) {
        return
      }

      const { error: updateError } = await service
        .from('notes')
        .update({ cluster_id: clusterId })
        .eq('workshop_id', workshopId)
        .in('id', cluster.note_ids)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }),
  )

  await clearClusterStaleFlags(service, workshopId)
  return getClustersWithNotes(service, workshopId)
}

export async function clearClusterStaleFlags(service: ServiceClient, workshopId: string) {
  await Promise.all([
    service.from('clusters').update({ is_stale: false }).eq('workshop_id', workshopId),
    service.from('design_artifacts').update({ is_stale: false }).eq('workshop_id', workshopId),
    service.from('prds').update({ is_stale: false }).eq('workshop_id', workshopId),
    service.from('ax_reports').update({ is_stale: false }).eq('workshop_id', workshopId),
  ])
}

export async function propagateClusterStaleIfNeeded(
  service: ServiceClient,
  workshop: Tables<'workshops'>,
) {
  await propagateStale(service, workshop.id, 'cluster')
}

function normalizeClusterName(name: string) {
  return name.trim().toLocaleLowerCase('ko-KR')
}
