'use client'

import { Check, KeyRound, LogOut, Shield, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type AdminUser = {
  id: string
  email: string
  name: string
  role: string
  approved: boolean
  created_at: string
  last_sign_in_at: string | null
}

export function AdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (!res.ok) {
      toast.error('사용자 목록을 불러오는데 실패했습니다.')
      return
    }
    const payload = await res.json()
    setUsers(payload.data.users)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function handleApproval(userId: string, approved: boolean) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approved }),
    })

    if (!res.ok) {
      const payload = await res.json()
      toast.error(payload.error?.message ?? '처리에 실패했습니다.')
      return
    }

    toast.success(approved ? '승인되었습니다.' : '승인이 취소되었습니다.')
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, approved } : u)),
    )
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setChangingPassword(true)
    const res = await fetch('/api/admin/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    setChangingPassword(false)

    if (!res.ok) {
      const payload = await res.json()
      setPasswordError(payload.error?.message ?? '비밀번호 변경에 실패했습니다.')
      return
    }

    toast.success('비밀번호가 변경되었습니다.')
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswordForm(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth/login')
    router.refresh()
  }

  const pendingUsers = users.filter((u) => !u.approved && u.role !== 'admin')
  const approvedUsers = users.filter((u) => u.approved && u.role !== 'admin')
  const adminUsers = users.filter((u) => u.role === 'admin')

  return (
    <main className="min-h-screen bg-canvas-parchment px-6 py-8 text-ink">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <Shield aria-hidden className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">관리자 대시보드</h1>
              <p className="mt-1 text-sm text-ink-muted-48">사용자 승인 및 관리</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
            >
              워크샵 대시보드
            </Link>
            <button
              type="button"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
            >
              <KeyRound aria-hidden className="h-4 w-4" />
              비밀번호 변경
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </header>

        {/* Password Change Form */}
        {showPasswordForm && (
          <div className="mb-6 rounded-apple-lg border border-hairline bg-white p-6">
            <h2 className="mb-4 text-lg font-medium">비밀번호 변경</h2>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-ink">
                  새 비밀번호
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full max-w-sm rounded-full border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-ink">
                  비밀번호 확인
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full max-w-sm rounded-full border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
              <button
                type="submit"
                disabled={changingPassword}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
              >
                {changingPassword ? '변경 중...' : '변경'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-apple-lg bg-white" />
            ))}
          </div>
        ) : (
          <>
            {/* Pending Approval */}
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-medium">
                승인 대기 <span className="text-sm font-normal text-ink-muted-48">({pendingUsers.length})</span>
              </h2>
              {pendingUsers.length === 0 ? (
                <p className="rounded-apple-lg border border-hairline bg-white p-4 text-sm text-ink-muted-48">
                  승인 대기 중인 사용자가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingUsers.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onApprove={() => handleApproval(u.id, true)}
                      onReject={() => handleApproval(u.id, false)}
                      showActions
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Approved Users */}
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-medium">
                승인된 사용자 <span className="text-sm font-normal text-ink-muted-48">({approvedUsers.length})</span>
              </h2>
              {approvedUsers.length === 0 ? (
                <p className="rounded-apple-lg border border-hairline bg-white p-4 text-sm text-ink-muted-48">
                  승인된 사용자가 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {approvedUsers.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onReject={() => handleApproval(u.id, false)}
                      showRevoke
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Admin Users */}
            <section>
              <h2 className="mb-3 text-lg font-medium">
                관리자 <span className="text-sm font-normal text-ink-muted-48">({adminUsers.length})</span>
              </h2>
              <div className="space-y-2">
                {adminUsers.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function UserRow({
  user,
  onApprove,
  onReject,
  showActions,
  showRevoke,
}: {
  user: AdminUser
  onApprove?: () => void
  onReject?: () => void
  showActions?: boolean
  showRevoke?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-apple-lg border border-hairline bg-white px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{user.name || '(이름 없음)'}</span>
          {user.role === 'admin' && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              관리자
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted-48">{user.email}</p>
        <p className="text-xs text-ink-muted-48">
          가입: {new Date(user.created_at).toLocaleDateString('ko-KR')}
          {user.last_sign_in_at && (
            <> · 최근 로그인: {new Date(user.last_sign_in_at).toLocaleDateString('ko-KR')}</>
          )}
        </p>
      </div>
      <div className="flex gap-2">
        {showActions && (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              <Check aria-hidden className="h-3.5 w-3.5" />
              승인
            </button>
            <button
              type="button"
              onClick={onReject}
              className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-red-50"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
              거부
            </button>
          </>
        )}
        {showRevoke && (
          <button
            type="button"
            onClick={onReject}
            className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-red-50"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            승인 취소
          </button>
        )}
      </div>
    </div>
  )
}
