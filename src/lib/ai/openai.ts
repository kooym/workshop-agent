import { AzureOpenAI } from 'openai'
import { getServerEnv } from '@/lib/env'

export function createAzureOpenAIClient() {
  const env = getServerEnv()

  return new AzureOpenAI({
    endpoint: env.AZURE_OPENAI_ENDPOINT,
    apiKey: env.AZURE_OPENAI_API_KEY,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
    deployment: env.AZURE_OPENAI_DEPLOYMENT,
    timeout: 600_000,
    maxRetries: 0,
  })
}

export async function createChatCompletionJson({
  system,
  user,
  maxTokens,
  timeoutMs,
}: {
  system: string
  user: string
  maxTokens: number
  timeoutMs?: number
}) {
  const env = getServerEnv()
  const client = createAzureOpenAIClient()
  const completion = await client.chat.completions.create(
    {
      model: env.AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: maxTokens,
    },
    timeoutMs ? { timeout: timeoutMs } : undefined,
  )

  if (completion.choices[0]?.finish_reason === 'length') {
    throw new Error('Azure OpenAI 응답이 최대 토큰 제한으로 잘렸습니다.')
  }

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('Azure OpenAI 응답이 비어 있습니다.')
  }

  return content
}
