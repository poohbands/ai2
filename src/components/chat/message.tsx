'use client'

import { Message } from '@/types'
import { cn } from '@/lib/utils'
import { Copy, RotateCcw, Edit2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useState } from 'react'

interface MessageProps {
  message: Message
  isStreaming?: boolean
  onRegenerate?: () => void
  onEdit?: (content: string) => void
  onCopy?: (content: string) => void
}

export function MessageComponent({ message, isStreaming, onRegenerate, onEdit, onCopy }: MessageProps) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const handleCopy = () => {
    if (onCopy) onCopy(message.content)
    else navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(editContent)
    }
    setEditing(false)
  }

  const content = typeof message.content === 'string' ? message.content : ''
  const isUser = message.role === 'user'

  return (
    <div className={cn('group flex w-full gap-3 py-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold mt-1">
          AI
        </div>
      )}

      <div className={cn('flex flex-col min-w-0', isUser ? 'items-end max-w-[85%]' : 'flex-1 items-start')}>
        <div
          className={cn(
            'px-4 py-2.5 text-[15px] leading-relaxed break-words',
            isUser
              ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md max-w-full'
              : 'w-full text-foreground'
          )}
        >
          {message.role === 'system' ? (
            <p className="text-sm text-muted-foreground italic">{content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
              components={{
                p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc ml-5 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-5 my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground">{children}</blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="border-collapse text-sm w-full">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-muted/60 px-3 py-1.5 text-left font-semibold">{children}</th>
                ),
                td: ({ children }) => <td className="border border-border px-3 py-1.5">{children}</td>,
                pre: ({ children }) => (
                  <pre className="bg-muted/70 p-3 rounded-lg overflow-x-auto text-[13px] my-2">{children}</pre>
                ),
                code: ({ className, children }) =>
                  className ? (
                    <code className={className}>{children}</code>
                  ) : (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>
                  ),
                a: ({ href, children, ...props }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80" {...props}>
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-3 border-border" />,
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>

        <div
          className={cn(
            'flex items-center gap-1 mt-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100',
            isUser && 'flex-row-reverse'
          )}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{copied ? 'Copied!' : 'Copy'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {isUser && onEdit && !editing && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => {
                      setEditContent(content)
                      setEditing(true)
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Edit</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {!isUser && onRegenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onRegenerate} disabled={isStreaming}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Regenerate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {editing && (
            <div className="flex items-center gap-2 w-full min-w-[280px]">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                onBlur={handleEdit}
                autoFocus
                className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleEdit}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-semibold mt-1">
          U
        </div>
      )}
    </div>
  )
}
