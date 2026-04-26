import SupabaseProvider from 'y-supabase/dist/index.js'
import * as Y from 'yjs'
import { createBrowserClient } from '@/lib/supabase/client'

export type YjsProviderHandle = {
  yDoc: Y.Doc
  provider: SupabaseProvider
}

export async function createYjsProvider(workshopId: string): Promise<YjsProviderHandle> {
  const yDoc = new Y.Doc()
  const supabase = createBrowserClient()

  const { error } = await supabase.from('yjs_documents').upsert(
    {
      id: workshopId,
      document: [],
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )

  if (error) {
    console.warn('failed to initialize yjs document row', error.message)
  }

  const provider = new SupabaseProvider(yDoc, supabase, {
    channel: `yjs:${workshopId}`,
    tableName: 'yjs_documents',
    columnName: 'document',
    idName: 'id',
    id: workshopId,
  })

  return { yDoc, provider }
}

export function destroyYjsProvider(handle: YjsProviderHandle) {
  handle.provider.destroy()
  handle.yDoc.destroy()
}
