'use client'

import { Message } from '@/types'
import { cn } from '@/lib/utils'
import { Copy, RotateCcw, Edit2, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useState, useEffect } from 'react'

interface MessageProps {
  message: Message
  isStreaming?: boolean
  statusText?: string
  onRegenerate?: () => void
  onEdit?: (content: string) => void
  onCopy?: (content: string) => void
}

function parseThinkContent(raw: string) {
  const match = raw.match(/<think>([\s\S]*?)(?:<\/think>([\s\S]*)|$)/i)
  if (!match) return { thinking: null, answer: raw, isDoneThinking: true }

  const thinking = match[1].trim()
  const isDoneThinking = raw.includes('</think>')
  const answer = (match[2] || '').trim()
  return { thinking, answer, isDoneThinking }
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc ml-5 my-2 space-y-1">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal ml-5 my-2 space-y-1">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-3">
      <table className="border-collapse text-sm w-full">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border bg-muted/60 px-3 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => <td className="border border-border px-3 py-1.5">{children}</td>,
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted/70 p-3 rounded-lg overflow-x-auto text-[13px] my-2">{children}</pre>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>
    ),
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80" {...props}>
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-border" />,
}

export function MessageComponent({ message, isStreaming, statusText, onRegenerate, onEdit, onCopy }: MessageProps) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [elapsed, setElapsed] = useState(0)
  const [showThinking, setShowThinking] = useState(false)

  useEffect(() => {
    if (!isStreaming) {
      setElapsed(0)
      return
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [isStreaming])

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
  const { thinking, answer, isDoneThinking } = parseThinkContent(content)

  const getThinkingStep = (sec: number) => {
    if (statusText) {
      return {
        title: statusText,
        detail: 'กำลังติดต่อและประมวลผลข้อมูล...',
        stepIndex: 1,
      }
    }
    if (sec < 2) {
      return {
        title: 'กำลังวิเคราะห์คำถามและบริบท...',
        detail: 'ทำความเข้าใจประเด็นหลักและเป้าหมายของคำถาม',
        stepIndex: 0,
      }
    }
    if (sec < 5) {
      return {
        title: 'กำลังค้นหาและประมวลผลข้อมูล...',
        detail: 'รวบรวมข้อมูลที่เกี่ยวข้องและจัดลำดับความคิด',
        stepIndex: 1,
      }
    }
    return {
      title: 'กำลังเรียบเรียงและสรุปคำตอบ...',
      detail: 'สร้างคำตอบให้ชัดเจน ครบถ้วน และตรงประเด็น',
      stepIndex: 2,
    }
  }

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
              ? 'bg-neutral-900 dark:bg-neutral-100 rounded-2xl rounded-br-md max-w-full'
              : 'w-full text-foreground'
          )}
          style={isUser ? { color: '#ffffff', backgroundColor: '#18181b' } : {}}
        >
          {message.role === 'system' ? (
            <p className="text-sm text-muted-foreground italic">{content}</p>
          ) : !isUser && isStreaming && !content ? (
            <div className="py-1 space-y-2.5 max-w-md">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-primary animate-pulse flex-shrink-0" />
                <span>{getThinkingStep(elapsed).title}</span>
                <span className="text-xs text-muted-foreground font-mono">({elapsed}s)</span>
                <span className="inline-flex gap-1 ml-auto">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce"></span>
                </span>
              </div>

              <div className="bg-muted/40 border border-border/60 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span>กระบวนการคิด</span>
                  <span className="text-primary font-normal">• กำลังทำงาน</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { label: '1. วิเคราะห์', desc: 'ทำความเข้าใจ' },
                    { label: '2. ประมวลผล', desc: 'รวบรวมข้อมูล' },
                    { label: '3. เรียบเรียง', desc: 'สรุปคำตอบ' },
                  ].map((step, idx) => {
                    const activeIndex = getThinkingStep(elapsed).stepIndex
                    const isActive = idx === activeIndex
                    const isDone = idx < activeIndex
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'px-2 py-1.5 rounded-lg border text-center transition-all duration-300 flex flex-col items-center justify-center gap-0.5',
                          isActive && 'bg-primary/10 border-primary/40 text-primary font-medium shadow-sm',
                          isDone && 'bg-muted/70 border-border/40 text-muted-foreground',
                          !isActive && !isDone && 'border-border/20 text-muted-foreground/50 opacity-60'
                        )}
                      >
                        <span className="text-[11px] leading-none">{step.label}</span>
                        <span className="text-[10px] leading-tight opacity-80 hidden sm:inline">{step.desc}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping inline-block flex-shrink-0"></span>
                  <span className="truncate">{getThinkingStep(elapsed).detail}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {thinking && (
                <div className="mb-3 rounded-xl border border-border/60 bg-muted/30 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setShowThinking((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors font-medium text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>
                        {isDoneThinking ? 'กระบวนการคิด (Thinking Process)' : 'กำลังคิดวิเคราะห์... (Thinking)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span>{showThinking ? 'ย่อ' : 'ดูรายละเอียด'}</span>
                      {showThinking ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                  {showThinking && (
                    <div className="px-3 py-2.5 border-t border-border/40 bg-background/50 text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {thinking}
                    </div>
                  )}
                </div>
              )}

              {(answer || !thinking) && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                  components={markdownComponents}
                >
                  {answer || content}
                </ReactMarkdown>
              )}
            </>
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
