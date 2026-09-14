'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, Send, X, Loader2, Mic, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDropzone } from 'react-dropzone'

interface ChatInputProps {
  onSend: (message: string, files: File[]) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  placeholder?: string
  maxFiles?: number
}

export function ChatInput({ onSend, onStop, disabled, isGenerating, placeholder = 'Message...', maxFiles = 5 }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<unknown>(null)

  const toggleVoice = useCallback(() => {
    interface SpeechRecognitionCtor {
      new (): {
        lang: string
        interimResults: boolean
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
        onend: (() => void) | null
        onerror: (() => void) | null
        start: () => void
        stop: () => void
      }
    }
    const w = window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor; SpeechRecognition?: SpeechRecognitionCtor }
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition
    if (!SR) {
      alert('เบราว์เซอร์นี้ไม่รองรับ Voice input (ใช้ Chrome)')
      return
    }
    if (listening) {
      (recognitionRef.current as { stop: () => void } | null)?.stop()
      setListening(false)
      return
    }
    const rec = new SR()
    rec.lang = 'th-TH'
    rec.interimResults = false
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = e.results[0]?.[0]?.transcript || ''
      if (transcript) setText((p) => (p ? p + ' ' : '') + transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }, [listening])

  const speakLast = useCallback(() => {
    if (!text.trim()) return
    try {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'th-TH'
      speechSynthesis.speak(u)
    } catch { /* ignore */ }
  }, [text])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    // noClick: only the attach button opens the picker (clicking textarea must not)
    noClick: true,
    noKeyboard: true,
    onDrop: (acceptedFiles) => {
      const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles)
      setFiles(newFiles)
    },
    maxFiles,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
  })

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
        e.preventDefault()
        if (text.trim() || files.length > 0) {
          onSend(text.trim(), files)
          setText('')
          setFiles([])
        }
      }
    },
    [text, files, onSend]
  )

  const handleSend = useCallback(() => {
    if (text.trim() || files.length > 0) {
      onSend(text.trim(), files)
      setText('')
      setFiles([])
    }
  }, [text, files, onSend])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  if (isGenerating && onStop) {
    return (
      <div className="border-t border-border p-4" {...getRootProps()}>
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={onStop} disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generating response...</span>
          </div>
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 max-w-4xl mx-auto">
            {files.map((file, index) => (
              <span key={index} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-full">
                {file.name}
                <button type="button" onClick={() => removeFile(index)} className="hover:text-destructive">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('border-t border-border p-4 flex-shrink-0', isDragActive && 'bg-accent')} {...getRootProps()}>
      <input {...getInputProps()} type="file" multiple accept=".txt,.csv,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp" />
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={open}
            disabled={disabled || files.length >= maxFiles}
            title="แนบไฟล์"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full min-h-[44px] max-h-[200px] px-4 py-2.5 pr-12 bg-background border border-input rounded-xl resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={1}
            />
          </div>

          <Button variant="ghost" size="icon" className={cn('h-9 w-9 flex-shrink-0', listening && 'text-red-500')} onClick={toggleVoice} disabled={disabled} title="Voice input">
            <Mic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={speakLast} disabled={disabled || !text.trim()} title="อ่านออกเสียง">
            <Volume2 className="h-4 w-4" />
          </Button>

          <Button
            onClick={handleSend}
            disabled={disabled || (!text.trim() && files.length === 0)}
            size="icon"
            className="h-9 w-9 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 max-w-4xl mx-auto">
          {files.map((file, index) => (
            <span key={index} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-full">
              {file.name}
              <button type="button" onClick={() => removeFile(index)} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}