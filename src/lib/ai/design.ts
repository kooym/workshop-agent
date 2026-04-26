import { buildDesignPrompt } from '@/lib/ai/prompts'
import { parseDesignResponse, type DesignResponse, type DesignValidationContext } from '@/lib/ai/schemas'
import { createChatCompletionJson } from './openai'

const RETRY_DELAYS_MS = [1000, 2000] as const

type CompletionFn = typeof createChatCompletionJson

export async function generateDesignWithAI(
  input: Parameters<typeof buildDesignPrompt>[0],
  context: DesignValidationContext,
  options: {
    createCompletion?: CompletionFn
    wait?: (milliseconds: number) => Promise<void>
  } = {},
): Promise<DesignResponse> {
  const createCompletion = options.createCompletion ?? createChatCompletionJson
  const wait = options.wait ?? defaultWait
  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const prompt = buildDesignPrompt(input)
      const raw = await createCompletion({
        ...prompt,
        maxTokens: 4000,
      })
      return parseDesignResponse(raw, context)
    } catch (error) {
      lastError = error
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) {
        break
      }
      await wait(delay)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI AX 설계에 실패했습니다.')
}

function defaultWait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
