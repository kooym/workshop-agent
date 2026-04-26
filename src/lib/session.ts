import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { getServerEnv } from '@/lib/env'

export const PARTICIPANT_SESSION_COOKIE = 'participant_session'
export const PARTICIPANT_SESSION_MAX_AGE = 86_400

export type ParticipantSession = {
  workshopId: string
  participantId: string
}

function getSessionSecret() {
  return getServerEnv().SESSION_SECRET
}

export function signSession(workshopId: string, participantId: string): string {
  const payload = Buffer.from(`${workshopId}:${participantId}`).toString('base64url')
  const signature = createHmac('sha256', getSessionSecret()).update(payload).digest('hex')

  return `v1:${payload}.${signature}`
}

export function verifySession(cookieValue: string): ParticipantSession | null {
  if (!cookieValue.startsWith('v1:')) {
    return null
  }

  const body = cookieValue.slice(3)
  const dotIndex = body.lastIndexOf('.')
  if (dotIndex === -1) {
    return null
  }

  const payload = body.slice(0, dotIndex)
  const signature = body.slice(dotIndex + 1)
  const expected = createHmac('sha256', getSessionSecret()).update(payload).digest('hex')

  try {
    const signatureBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null
    }

    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    const [workshopId, participantId] = decoded.split(':')
    if (!workshopId || !participantId) {
      return null
    }

    return { workshopId, participantId }
  } catch {
    return null
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: PARTICIPANT_SESSION_MAX_AGE,
    path: '/',
  }
}

export async function setSession(workshopId: string, participantId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(
    PARTICIPANT_SESSION_COOKIE,
    signSession(workshopId, participantId),
    getSessionCookieOptions(),
  )
}

export async function getSession(): Promise<ParticipantSession | null> {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(PARTICIPANT_SESSION_COOKIE)?.value
  return cookieValue ? verifySession(cookieValue) : null
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PARTICIPANT_SESSION_COOKIE)
}
