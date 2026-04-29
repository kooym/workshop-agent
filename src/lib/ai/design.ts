import {
  buildDesignCorePrompt,
  buildDesignTasksPrompt,
  buildDesignStep1Prompt,
  buildDesignStep2Prompt,
  buildDesignStep3Prompt,
  buildFinalTaskPrompt,
  buildSolutionCanvasPrompt,
  type DesignPromptInput,
} from '@/lib/ai/prompts'
import {
  parseDesignPhase1,
  parseDesignPhase2,
  mergeDesignPhases,
  parseDesignStep1,
  parseDesignStep2,
  parseDesignStep3,
  parseFinalTaskResult,
  parseSolutionCanvas,
  type SingleDesignAlternative,
  type DesignValidationContext,
  type DesignStep1Result,
  type DesignStep2Result,
  type DesignStep3Result,
  type FinalTaskResult,
  type SolutionCanvasResult,
} from '@/lib/ai/schemas'
import { createChatCompletionJson } from './openai'

const RETRY_DELAYS_MS = [1000, 2000] as const
const PHASE1_TIMEOUT_MS = 300_000
const PHASE1_MAX_TOKENS = 8000
const PHASE2_TIMEOUT_MS = 300_000
const PHASE2_MAX_TOKENS = 8000

const STEP_TIMEOUT_MS = 300_000
const STEP1_MAX_TOKENS = 16000
const STEP2_MAX_TOKENS = 12000
const STEP3_MAX_TOKENS = 10000
const FINAL_TASK_MAX_TOKENS = 8000

type CompletionFn = typeof createChatCompletionJson

export type DesignAIResult = {
  alternative: SingleDesignAlternative
  warnings: string[]
}

export type DesignStepResult =
  | { step: 1; data: { step1: DesignStep1Result; step2: DesignStep2Result; step3: DesignStep3Result } }
  | { step: 3; data: { finalTask: FinalTaskResult } }
  | { step: 4; data: { canvas: SolutionCanvasResult } }

export async function generateDesignWithAI(
  strategyIndex: 0 | 1 | 2,
  input: DesignPromptInput,
  context: DesignValidationContext,
  options: {
    createCompletion?: CompletionFn
    wait?: (milliseconds: number) => Promise<void>
  } = {},
): Promise<DesignAIResult> {
  const createCompletion = options.createCompletion ?? createChatCompletionJson
  const wait = options.wait ?? defaultWait
  const allWarnings: string[] = []

  // Phase 1: Core design (tobe_process + agent_specs)
  const phase1 = await runWithRetry(
    async () => {
      const prompt = buildDesignCorePrompt(strategyIndex, input)
      const raw = await createCompletion({
        ...prompt,
        maxTokens: PHASE1_MAX_TOKENS,
        timeoutMs: PHASE1_TIMEOUT_MS,
      })
      return parseDesignPhase1(raw, context)
    },
    { retryDelays: RETRY_DELAYS_MS, wait, label: 'Phase 1 (Core Design)' },
  )
  allWarnings.push(...phase1.warnings)

  // Phase 2: Implementation plan (tasks + kpis + data_requirements)
  const phase2 = await runWithRetry(
    async () => {
      const prompt = buildDesignTasksPrompt(strategyIndex, input, phase1.phase1)
      const raw = await createCompletion({
        ...prompt,
        maxTokens: PHASE2_MAX_TOKENS,
        timeoutMs: PHASE2_TIMEOUT_MS,
      })
      return parseDesignPhase2(raw, context)
    },
    { retryDelays: RETRY_DELAYS_MS, wait, label: 'Phase 2 (Implementation)' },
  )
  allWarnings.push(...phase2.warnings)

  const alternative = mergeDesignPhases(phase1.phase1, phase2.phase2)
  return { alternative, warnings: allWarnings }
}

/** Run a single design step (1, 3, or 4) — step 2 is voting (no AI) */
export async function generateDesignStep(
  step: number,
  input: DesignPromptInput,
  context: DesignValidationContext,
  previousSteps: {
    step1?: DesignStep1Result
    step2?: DesignStep2Result
    step3?: DesignStep3Result
  },
  options: {
    createCompletion?: CompletionFn
    wait?: (milliseconds: number) => Promise<void>
    facilitatorNote?: string
    selectedTasks?: { id: string; title: string; description: string | null; core_features: unknown; sub_features: unknown; expected_effect: string | null; kpi_name: string | null }[]
    finalTaskDetail?: Record<string, unknown>
  } = {},
): Promise<{ result: DesignStepResult; warnings: string[] }> {
  const createCompletion = options.createCompletion ?? createChatCompletionJson
  const wait = options.wait ?? defaultWait
  const note = options.facilitatorNote
  const allWarnings: string[] = []

  switch (step) {
    case 1: {
      // Chain: TO-BE Process → Agent Specs → Tasks
      const { data: s1Data, warnings: w1 } = await runWithRetry(
        async () => {
          const { system, user, idMap } = buildDesignStep1Prompt(input, note)
          const raw = await createCompletion({
            system,
            user,
            maxTokens: STEP1_MAX_TOKENS,
            timeoutMs: STEP_TIMEOUT_MS,
          })
          return parseDesignStep1(raw, context, idMap)
        },
        { retryDelays: RETRY_DELAYS_MS, wait, label: 'Step 1-1 (TO-BE Process)' },
      )
      allWarnings.push(...w1)

      const { data: s2Data, warnings: w2 } = await runWithRetry(
        async () => {
          const prompt = buildDesignStep2Prompt(input, s1Data, note)
          const raw = await createCompletion({
            ...prompt,
            maxTokens: STEP2_MAX_TOKENS,
            timeoutMs: STEP_TIMEOUT_MS,
          })
          return parseDesignStep2(raw)
        },
        { retryDelays: RETRY_DELAYS_MS, wait, label: 'Step 1-2 (Agent Specs)' },
      )
      allWarnings.push(...w2)

      const { data: s3Data, warnings: w3 } = await runWithRetry(
        async () => {
          const prompt = buildDesignStep3Prompt(input, s1Data, s2Data, note)
          const raw = await createCompletion({
            ...prompt,
            maxTokens: STEP3_MAX_TOKENS,
            timeoutMs: STEP_TIMEOUT_MS,
          })
          return parseDesignStep3(raw, context)
        },
        { retryDelays: RETRY_DELAYS_MS, wait, label: 'Step 1-3 (Tasks)' },
      )
      allWarnings.push(...w3)

      return {
        result: { step: 1, data: { step1: s1Data, step2: s2Data, step3: s3Data } },
        warnings: allWarnings,
      }
    }
    case 3: {
      // Final task: deep expansion of the single winning task
      const selectedTasks = options.selectedTasks
      if (!selectedTasks || selectedTasks.length === 0) {
        throw new Error('선정된 과제가 필요합니다.')
      }

      const { data: finalTask, warnings: wf } = await runWithRetry(
        async () => {
          const prompt = buildFinalTaskPrompt(input, selectedTasks.slice(0, 1), note)
          const raw = await createCompletion({
            ...prompt,
            maxTokens: FINAL_TASK_MAX_TOKENS,
            timeoutMs: STEP_TIMEOUT_MS,
          })
          return parseFinalTaskResult(raw)
        },
        { retryDelays: RETRY_DELAYS_MS, wait, label: 'Step 3 (Final Task)' },
      )
      allWarnings.push(...wf)

      return {
        result: { step: 3, data: { finalTask } },
        warnings: allWarnings,
      }
    }
    case 4: {
      // Solution canvas from final_task_detail
      const ftd = options.finalTaskDetail
      if (!ftd) throw new Error('최종 과제 상세가 필요합니다.')

      const CANVAS_MAX_TOKENS = 8000
      const { data: canvas, warnings: wc } = await runWithRetry(
        async () => {
          const prompt = buildSolutionCanvasPrompt(input, ftd, note)
          const raw = await createCompletion({
            ...prompt,
            maxTokens: CANVAS_MAX_TOKENS,
            timeoutMs: STEP_TIMEOUT_MS,
          })
          return parseSolutionCanvas(raw)
        },
        { retryDelays: RETRY_DELAYS_MS, wait, label: 'Step 4 (Solution Canvas)' },
      )
      allWarnings.push(...wc)

      return {
        result: { step: 4, data: { canvas } },
        warnings: allWarnings,
      }
    }
    default:
      throw new Error(`유효하지 않은 설계 단계: ${step}`)
  }
}

async function runWithRetry<T>(
  fn: () => Promise<T>,
  opts: {
    retryDelays: readonly number[]
    wait: (ms: number) => Promise<void>
    label: string
  },
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= opts.retryDelays.length; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const errorInfo = error instanceof Error ? error.message : String(error)
      console.error(`[AI Design ${opts.label}] attempt ${attempt + 1} failed:`, errorInfo)
      const delay = opts.retryDelays[attempt]
      if (delay === undefined) {
        break
      }
      await opts.wait(delay)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`AI AX 설계 ${opts.label}에 실패했습니다.`)
}

function defaultWait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
