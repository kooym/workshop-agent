'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MermaidDiagram } from './MermaidDiagram'

const markdownComponents: Components = {
  code({ className, children }) {
    const language = className?.replace('language-', '') ?? ''
    const content = String(children).trim()

    if (language === 'mermaid') {
      return <MermaidDiagram dsl={content} />
    }

    return (
      <code className={className}>
        {children}
      </code>
    )
  },
  table({ children }) {
    return (
      <div className="my-4 min-w-0 overflow-x-auto rounded-apple-lg border border-hairline">
        <table className="w-full text-sm">{children}</table>
      </div>
    )
  },
  thead({ children }) {
    return <thead className="bg-surface-pearl text-left text-xs font-semibold uppercase tracking-wider text-ink-muted-80">{children}</thead>
  },
  th({ children }) {
    return <th className="whitespace-nowrap px-3 py-2">{children}</th>
  },
  td({ children }) {
    return <td className="border-t border-hairline px-3 py-2 text-ink">{children}</td>
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-4 border-primary bg-blue-50 py-2 pl-4 pr-3 text-sm text-ink [&>p]:m-0">
        {children}
      </blockquote>
    )
  },
  hr() {
    return <hr className="my-8 border-hairline" />
  },
}

export function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`prose prose-slate max-w-none prose-headings:tracking-normal prose-h1:border-b prose-h1:border-hairline prose-h1:pb-3 prose-h2:mt-8 prose-h2:border-b prose-h2:border-hairline prose-h2:pb-2 prose-p:my-2 prose-li:my-0.5 prose-a:text-primary prose-code:text-primary prose-pre:border prose-pre:border-hairline prose-pre:bg-surface-pearl prose-strong:text-ink ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  )
}
