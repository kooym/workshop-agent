import { NextResponse } from 'next/server'

export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PROCESSING: 'PROCESSING',
  STAGE_LOCKED: 'STAGE_LOCKED',
  STALE_LOCK: 'STALE_LOCK',
  VOTE_LIMIT: 'VOTE_LIMIT',
  PARTICIPANT_LIMIT: 'PARTICIPANT_LIMIT',
  NOTE_LIMIT: 'NOTE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function error(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export const failure = error
