'use client'

import { useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/auth/login')
        return
      }

      setIsReady(true)
    })
  }, [router])

  if (!isReady) {
    return <div className="p-6 text-sm text-ink-muted-48">세션을 확인하는 중입니다.</div>
  }

  return children
}
