import { buildPrdPrompt, buildReportPrompt } from '@/lib/ai/prompts'
import { parseMarkdownContentResponse } from '@/lib/ai/schemas'
import { createChatCompletionJson } from './openai'

type CompletionFn = typeof createChatCompletionJson

const RETRY_DELAYS_MS = [1000, 2000] as const
const REPORT_RETRY_DELAYS_MS = [2000] as const

function defaultWait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function generatePrdWithAI(
  input: Parameters<typeof buildPrdPrompt>[0],
  options: {
    createCompletion?: CompletionFn
    wait?: (ms: number) => Promise<void>
  } = {},
) {
  const createCompletion = options.createCompletion ?? createChatCompletionJson
  const wait = options.wait ?? defaultWait
  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const prompt = buildPrdPrompt(input)
      const raw = await createCompletion({
        ...prompt,
        maxTokens: 12000,
        timeoutMs: 180_000,
      })
      return parseMarkdownContentResponse(raw, { maxLength: 50_000, label: 'PRD' })
    } catch (error) {
      lastError = error
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) break
      await wait(delay)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI PRD 생성에 실패했습니다.')
}

export async function generateReportWithAI(
  input: Parameters<typeof buildReportPrompt>[0],
  options: {
    createCompletion?: CompletionFn
    wait?: (ms: number) => Promise<void>
  } = {},
) {
  const createCompletion = options.createCompletion ?? createChatCompletionJson
  const wait = options.wait ?? defaultWait
  let lastError: unknown

  for (let attempt = 0; attempt <= REPORT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const prompt = buildReportPrompt(input)
      const raw = await createCompletion({
        ...prompt,
        maxTokens: 16000,
        timeoutMs: 300_000,
      })
      return parseMarkdownContentResponse(raw, { maxLength: 80_000, label: '종합 보고서' })
    } catch (error) {
      lastError = error
      const delay = REPORT_RETRY_DELAYS_MS[attempt]
      if (delay === undefined) break
      await wait(delay)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI 종합 보고서 생성에 실패했습니다.')
}
