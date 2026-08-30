"use client"

import Markdown from "react-markdown"
import { Copy, Check } from "lucide-react"
import { useState, type ReactNode } from "react"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export function ProblemDescription({ content }: { content: string }) {
  return (
    <div className="prose-custom text-sm leading-relaxed">
      <Markdown
        components={{
          h1: ({ children }) => (
            <h1 className="mt-0 mb-4 text-xl font-bold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 text-base font-bold tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-sm font-bold">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-sm leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-") || String(children).includes("\n")
            if (isBlock) {
              const text = String(children).replace(/\n$/, "")
              return (
                <div className="relative my-3 group">
                  <CopyButton text={text} />
                  <pre className="overflow-x-auto rounded-lg bg-slate-950 dark:bg-black/60 border border-border p-4 text-xs leading-relaxed">
                    <code className="text-slate-100">{text}</code>
                  </pre>
                </div>
              )
            }
            return (
              <code className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-mono font-medium text-foreground border border-border/50">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>,
          ul: ({ children }) => (
            <ul className="mb-3 ml-4 list-disc space-y-1 text-sm marker:text-muted-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-4 list-decimal space-y-1 text-sm marker:text-muted-foreground marker:font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-1">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-orange-500/50 bg-orange-500/5 rounded-r-lg px-4 py-2 text-sm italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 px-3 py-1.5 font-mono text-xs">
              {children}
            </td>
          ),
          hr: () => <hr className="my-4 border-border" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
