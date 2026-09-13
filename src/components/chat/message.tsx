'use client'

import { Message } from '@/types'
import { cn } from '@/lib/utils'
import { Copy, RotateCcw, Edit2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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

  return (
    <div
      className={cn(
        'flex gap-3 max-w-3xl',
        message.role === 'assistant' ? 'items-start' : 'items-end justify-end'
      )}
    >
      {message.role === 'assistant' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm">
          AI
        </div>
      )}

      <div
        className={cn(
          'relative max-w-[85%] rounded-2xl px-4 py-3',
          message.role === 'user'
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md'
        )}
      >
        {message.role === 'system' ? (
          <p className="text-sm text-muted-foreground italic">{content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              [rehypeHighlight, { ignoreMissing: true }],
            ]}
            components={{
              code: ({ children, ...props }) => (
                <pre className="bg-muted/50 p-3 rounded-lg overflow-x-auto text-sm"><code {...props}>{children}</code></pre>
              ),
              a: ({ href, children, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        )}

        <div className="flex items-center gap-2 mt-2 opacity-0 transition-opacity group-hover:opacity-100">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{copied ? 'Copied!' : 'Copy'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {message.role === 'user' && onEdit && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
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

          {message.role === 'assistant' && onRegenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRegenerate} disabled={isStreaming}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Regenerate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {editing && (
            <div className="flex items-center gap-2 ml-auto">
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

      {message.role === 'user' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-sm">
          U
        </div>
      )}
    </div>
  )
}