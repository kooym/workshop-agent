'use client'

import type { Json } from '@/types/common'

export function AgentSpecCard({ value }: { value: Json }) {
  const agents = toArray(value)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {agents.map((agent, index) => (
        <article key={`${agent.name}-${index}`} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-base font-semibold text-white">{agent.name}</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-400">{agent.role}</p>
          <FeatureBlock title="핵심 기능" items={agent.core_features} />
          <FeatureBlock title="부가 기능" items={agent.sub_features} />
          <dl className="mt-4 grid gap-2 text-sm">
            <div>
              <dt className="text-neutral-500">입력</dt>
              <dd className="text-neutral-300">{agent.input}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">출력</dt>
              <dd className="text-neutral-300">{agent.output}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Human Checkpoint</dt>
              <dd className="text-neutral-300">{agent.human_checkpoint}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

function FeatureBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-neutral-500">{title}</p>
      <ul className="space-y-1 text-sm text-neutral-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function toArray(value: Json) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: String(item.name ?? 'Agent'),
      role: String(item.role ?? ''),
      core_features: toStringArray(item.core_features),
      sub_features: toStringArray(item.sub_features),
      input: String(item.input ?? ''),
      output: String(item.output ?? ''),
      human_checkpoint: String(item.human_checkpoint ?? ''),
    }))
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}
