import { buildClusteringPrompt, type ExistingClusterPromptInput } from '@/lib/ai/prompts'
import { parseClusteringResponse, type ClusteringResponse } from '@/lib/ai/schemas'
import { createChatCompletionJson } from './openai'

const RETRY_DELAYS_MS = [1000, 2000] as const

type CompletionFn = typeof createChatCompletionJson

export async function clusterNotesWithAI(
  notes: { id: string; content: string }[],
  existingClusters: ExistingClusterPromptInput[] = [],
  options: {
    createCompletion?: CompletionFn
    wait?: (milliseconds: number) => Promise<void>
  } = {},
): Promise<ClusteringResponse> {
  const createCompletion = options.createCompletion ?? createChatCompletionJson
  const wait = options.wait ?? defaultWait
  const inputNoteIds = notes.map((note) => note.id)
  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const prompt = buildClusteringPrompt(notes, existingClusters)
      const raw = await createCompletion({
        ...prompt,
        maxTokens: 2000,
      })
      return parseClusteringResponse(raw, inputNoteIds)
    } catch (error) {
      lastError = error
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) {
        break
      }
      await wait(delay)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI 클러스터링에 실패했습니다.')
}

function defaultWait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
