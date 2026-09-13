'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Conversation, Message, Model, Attachment } from '@/types'
import { Sidebar, MobileSidebarTrigger, MobileSidebarOverlay } from '@/components/sidebar/sidebar'
import { ChatInput } from '@/components/chat/chat-input'
import { ModelSelector } from '@/components/chat/model-selector'
import { MessageComponent } from '@/components/chat/message'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  Send,
  Loader2,
  X,
  Menu,
  ChevronLeft,
  Settings,
  User,
  LogOut,
} from 'lucide-react'

interface ChatClientProps {
  userId: string
  profile: Profile
}

export function ChatClient({ userId, profile }: ChatClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [webSearch, setWebSearch] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models')
      const data = await response.json()
      if (data.models) {
        setModels(data.models)
        if (!selectedModel && data.models.length > 0) {
          setSelectedModel(data.models[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    }
  }

  const fetchConversations = async () => {
    try {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
      if (data) setConversations(data)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }

  useEffect(() => {
    fetchModels()
    fetchConversations()
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId)
    } else {
      setMessages([])
    }
  }, [currentConversationId])

  const handleNewChat = () => {
    setCurrentConversationId(null)
    setMessages([])
    setSidebarOpen(false)
  }

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id)
    setSidebarOpen(false)
  }

  const handleDeleteConversation = async (id: string) => {
    if (!confirm('Delete this conversation?')) return
    try {
      await supabase.from('conversations').delete().eq('id', id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (currentConversationId === id) {
        setCurrentConversationId(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleRenameConversation = async (id: string, title: string) => {
    try {
      await supabase.from('conversations').update({ title }).eq('id', id)
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      )
    } catch (error) {
      console.error('Failed to rename conversation:', error)
    }
  }

  const handleTogglePin = async (id: string) => {
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return
    try {
      await supabase.from('conversations').update({ pinned: !conv.pinned }).eq('id', id)
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
      )
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

  const handleToggleArchive = async (id: string) => {
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return
    try {
      await supabase.from('conversations').update({ archived: !conv.archived }).eq('id', id)
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, archived: !c.archived } : c))
      )
    } catch (error) {
      console.error('Failed to toggle archive:', error)
    }
  }

  const handleSend = async (text: string, files: File[]) => {
    if (!selectedModel) return

    const controller = new AbortController()
    setAbortController(controller)
    setGenerating(true)

    let conversationId = currentConversationId
    let attachmentIds: string[] = []

    try {
      if (files.length > 0) {
        const formData = new FormData()
        files.forEach((file) => formData.append('file', file))
        if (conversationId) formData.append('conversationId', conversationId)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        const uploadData = await uploadResponse.json()
        if (uploadData.attachment) {
          attachmentIds = Array.isArray(uploadData.attachment)
            ? uploadData.attachment.map((a: Attachment) => a.id)
            : [uploadData.attachment.id]
        }
      }

      const newUserMessage = {
        role: 'user' as const,
        content: text,
      }

      if (attachmentIds.length > 0) {
        ;(newUserMessage as Record<string, unknown>).attachments = attachmentIds
      }

      setMessages((prev) => [...prev, { ...newUserMessage, id: 'temp', conversation_id: conversationId || '', user_id: userId, created_at: new Date().toISOString() } as Message])

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          model: selectedModel,
          messages: [...messages, newUserMessage],
          attachments: attachmentIds,
          stream: true,
          webSearch,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      if (!conversationId) {
        const reader = response.body?.getReader()
        if (reader) {
          const decoder = new TextDecoder()
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.conversationId) {
                    conversationId = parsed.conversationId
                    setCurrentConversationId(conversationId)
                    await fetchConversations()
                    break
                  }
                } catch {}
              }
            }
            if (conversationId) break
          }
        }
      }

      let fullContent = ''
      const reader2 = response.body?.getReader()
      if (reader2) {
        const decoder = new TextDecoder()
        let buffer = ''
        const messageId = 'temp-' + Date.now()

        setMessages((prev) => [...prev, { id: messageId, conversation_id: conversationId || '', user_id: userId, role: 'assistant', content: '', model: selectedModel, created_at: new Date().toISOString() } as Message])

        while (true) {
          const { done, value } = await reader2.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              try {
                const parsed = JSON.parse(data)
                if (parsed.error) {
                  throw new Error(parsed.error)
                }
                if (parsed.content) {
                  fullContent += parsed.content
                  setMessages((prev) =>
                    prev.map((m) => (m.id === messageId ? { ...m, content: fullContent } : m))
                  )
                }
                if (parsed.done) {
                  await fetchMessages(conversationId || '')
                  await fetchConversations()
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setMessages((prev) => prev.filter((m) => m.id.startsWith('temp-')))
      } else {
        console.error('Chat error:', error)
        setMessages((prev) =>
          prev.map((m) =>
            m.id.startsWith('temp-') ? { ...m, content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` } : m
          )
        )
      }
    } finally {
      setGenerating(false)
      setAbortController(null)
    }
  }

  const handleStop = () => {
    abortController?.abort()
    setGenerating(false)
  }

  const handleRegenerate = async (messageId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === messageId)
    if (msgIndex <= 0) return

    const userMsg = messages[msgIndex - 1]
    if (userMsg.role !== 'user') return

    setMessages((prev) => prev.slice(0, msgIndex))
    await handleSend(userMsg.content, [])
  }

  const handleEdit = async (messageId: string, newContent: string) => {
    const msgIndex = messages.findIndex((m) => m.id === messageId)
    if (msgIndex === -1) return

    await supabase.from('messages').update({ content: newContent }).eq('id', messageId)
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: newContent } : m)))
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <MobileSidebarOverlay isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        user={{
          email: profile.email,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        }}
        onLogout={handleLogout}
        isMobile={false}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 bg-card">
          <MobileSidebarTrigger onClick={() => setSidebarOpen(true)} />
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            disabled={generating}
            className="flex-1 max-w-xs"
          />
          <Button variant={webSearch ? 'default' : 'outline'} size="sm" onClick={() => setWebSearch((v) => !v)} title="ค้นเว็บก่อนตอบ">
            {webSearch ? 'Web ON' : 'Web OFF'}
          </Button>
          <nav className="hidden md:flex items-center gap-1 text-xs">
            <a href="/research" className="px-2 py-1 rounded hover:bg-accent">Research</a>
            <a href="/knowledge" className="px-2 py-1 rounded hover:bg-accent">KB</a>
            <a href="/compare" className="px-2 py-1 rounded hover:bg-accent">Compare</a>
            <a href="/images" className="px-2 py-1 rounded hover:bg-accent">Image</a>
            <a href="/prompts" className="px-2 py-1 rounded hover:bg-accent">Prompts</a>
          </nav>
        </header>

        <main className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full p-4">
            <div ref={chatContainerRef} className="flex flex-col items-center max-w-3xl mx-auto w-full gap-4">
              {messages.length === 0 && !currentConversationId && (
                <div className="text-center py-12 text-muted-foreground">
                  <h3 className="text-lg font-medium mb-2">Welcome to Family AI</h3>
                  <p className="text-sm">Start a new chat to begin</p>
                </div>
              )}
              {messages.map((message) => (
                <MessageComponent
                  key={message.id}
                  message={message}
                  isStreaming={generating && message.id.startsWith('temp-')}
                  onRegenerate={message.role === 'assistant' ? () => handleRegenerate(message.id) : undefined}
                  onEdit={message.role === 'user' ? (content) => handleEdit(message.id, content) : undefined}
                  onCopy={handleCopy}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <Separator />
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            disabled={generating}
            isGenerating={generating}
          />
        </main>
      </div>
    </div>
  )
}