'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Conversation, Message, Model, Attachment, KnowledgeBase, PromptItem, MenuFeatures, DEFAULT_MENU_FEATURES } from '@/types'
import { Sidebar, MobileSidebarTrigger, MobileSidebarOverlay } from '@/components/sidebar/sidebar'
import { ChatInput } from '@/components/chat/chat-input'
import { ModelSelector } from '@/components/chat/model-selector'
import { MessageComponent } from '@/components/chat/message'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Globe,
  Microscope,
  BookOpen,
  Columns2,
  Image as ImageIcon,
  ScrollText,
  Check,
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
  const [modeResearch, setModeResearch] = useState(false)
  const [modeKb, setModeKb] = useState(false)
  const [modeCompare, setModeCompare] = useState(false)
  const [modeImage, setModeImage] = useState(false)
  const [kbList, setKbList] = useState<KnowledgeBase[]>([])
  const [kbId, setKbId] = useState<string>('all')
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [promptId, setPromptId] = useState<string>('')
  const [compareModel, setCompareModel] = useState<string>('')
  const [features, setFeatures] = useState<MenuFeatures>(DEFAULT_MENU_FEATURES)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 300
    const saved = Number(window.localStorage.getItem('sidebar-width'))
    return Number.isFinite(saved) && saved >= 240 && saved <= 520 ? saved : 300
  })
  const resizingRef = useRef(false)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const w = Math.min(520, Math.max(240, ev.clientX))
      setSidebarWidth(w)
    }
    const onUp = () => {
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setSidebarWidth((w) => {
        window.localStorage.setItem('sidebar-width', String(w))
        return w
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
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

  const [convLoading, setConvLoading] = useState(false)
  const [convError, setConvError] = useState('')

  const fetchMessages = async (conversationId: string) => {
    setConvLoading(true)
    setConvError('')
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      if (data) setMessages(data)
      return data as Message[] | null
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      setConvError('โหลดข้อความไม่สำเร็จ กรุณาลองใหม่')
      return null
    } finally {
      setConvLoading(false)
    }
  }

  const fetchAssistData = async () => {
    try {
      const [kb, pr] = await Promise.all([
        fetch('/api/kb').then((r) => r.json()).catch(() => ({})),
        fetch('/api/prompts').then((r) => r.json()).catch(() => ({})),
      ])
      if (kb.knowledgeBases) setKbList(kb.knowledgeBases)
      if (pr.prompts) setPrompts(pr.prompts)
    } catch (error) {
      console.error('Failed to fetch assist data:', error)
    }
  }

  const fetchFeatures = async () => {
    try {
      const res = await fetch('/api/features')
      if (res.ok) {
        const d = await res.json()
        if (d?.features) {
          setFeatures(d.features)
          if (!d.features.web) setWebSearch(false)
          if (!d.features.research) setModeResearch(false)
          if (!d.features.kb) setModeKb(false)
          if (!d.features.compare) setModeCompare(false)
          if (!d.features.image) setModeImage(false)
          if (!d.features.prompts) setPromptId('')
        }
      }
    } catch (error) {
      console.error('Failed to fetch features:', error)
    }
  }

  useEffect(() => {
    fetchModels()
    fetchConversations()
    fetchAssistData()
    fetchFeatures()
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

  const ensureConversation = async (text: string): Promise<string> => {
    if (currentConversationId) return currentConversationId
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: text.slice(0, 60) || 'New Chat', model: selectedModel })
      .select()
      .single()
    if (error || !data) throw new Error('Failed to create conversation')
    setCurrentConversationId(data.id)
    fetchConversations()
    return data.id as string
  }

  const saveMessageRow = async (convId: string, role: 'user' | 'assistant', content: string, model?: string) => {
    const { error } = await supabase.from('messages').insert({
      conversation_id: convId,
      user_id: userId,
      role,
      content,
      model: model || selectedModel,
    })
    if (error) throw new Error('Failed to save message')
  }

  const readSSE = async (
    response: Response,
    onEvent: (e: Record<string, unknown>) => void | Promise<void>
  ) => {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response stream')
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          await onEvent(JSON.parse(line.slice(6)))
        } catch {
          continue
        }
      }
    }
  }

  const runResearchFlow = async (text: string, convId: string, signal: AbortSignal) => {
    const messageId = 'temp-' + Date.now()
    setMessages((prev) => [...prev, { id: messageId, conversation_id: convId, user_id: userId, role: 'assistant', content: 'กำลังค้นคว้า...', model: selectedModel, created_at: new Date().toISOString() } as Message])

    const response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, model: selectedModel, depth: 'standard', conversationId: convId, stream: true }),
      signal,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || 'Research failed')
    }

    let report = ''
    let sources: Array<{ title: string; url: string }> = []
    await readSSE(response, (e) => {
      if (e.step === 'token' && typeof e.content === 'string') {
        report += e.content
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: report } : m)))
      } else if (typeof e.content === 'string' && e.step !== 'done') {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: report ? report + '\n\n_' + e.content + '_' : '_' + e.content + '_' } : m)))
      }
      if (e.step === 'done') {
        if (typeof e.content === 'string' && e.content) report = e.content
        if (Array.isArray(e.sources)) sources = e.sources as Array<{ title: string; url: string }>
      }
      if (e.step === 'error') throw new Error(typeof e.content === 'string' ? e.content : 'Research failed')
    })

    const final = report + (sources.length ? '\n\n**แหล่งอ้างอิง**\n' + sources.map((s, i) => `[${i + 1}] [${s.title}](${s.url})`).join('\n') : '')
    await saveMessageRow(convId, 'assistant', final)
    await fetchMessages(convId)
    await fetchConversations()
  }

  const runCompareFlow = async (text: string, convId: string, signal: AbortSignal, secondModelId: string) => {
    const ids = [selectedModel, secondModelId]
    const names: Record<string, string> = {}
    for (const id of ids) {
      names[id] = models.find((m) => m.id === id)?.display_name || id
    }
    const tempIds: Record<string, string> = {}
    setMessages((prev) => [
      ...prev,
      ...ids.map((id) => {
        const tid = `temp-${id}-${Date.now()}`
        tempIds[id] = tid
        return { id: tid, conversation_id: convId, user_id: userId, role: 'assistant', content: `_${names[id]} กำลังตอบ..._`, model: id, created_at: new Date().toISOString() } as Message
      }),
    ])

    const response = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }], models: ids }),
      signal,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || 'Compare failed')
    }

    const buffers: Record<string, string> = { [ids[0]]: '', [ids[1]]: '' }
    const doneSet = new Set<string>()
    await readSSE(response, (e) => {
      const mid = e.modelId as string | undefined
      if (e.error) throw new Error(String(e.error))
      if (!mid || !tempIds[mid]) return
      if (typeof e.content === 'string' && e.content) {
        buffers[mid] += e.content
        const tid = tempIds[mid]
        const buf = buffers[mid]
        setMessages((prev) => prev.map((m) => (m.id === tid ? { ...m, content: buf } : m)))
      }
      if (e.done) {
        doneSet.add(mid)
        const tid = tempIds[mid]
        const buf = buffers[mid]
        setMessages((prev) => prev.map((m) => (m.id === tid ? { ...m, content: buf } : m)))
      }
    })

    for (const id of ids) {
      await saveMessageRow(convId, 'assistant', `**${names[id]}**\n\n${buffers[id]}`, id)
    }
    await fetchMessages(convId)
    await fetchConversations()
  }

  const runImageFlow = async (text: string, convId: string) => {
    const messageId = 'temp-' + Date.now()
    setMessages((prev) => [...prev, { id: messageId, conversation_id: convId, user_id: userId, role: 'assistant', content: '_กำลังสร้างภาพ..._', model: selectedModel, created_at: new Date().toISOString() } as Message])

    const response = await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, conversationId: convId }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Image generation failed')

    const md = `![${text}](${data.imageUrl})`
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: md } : m)))
    await saveMessageRow(convId, 'assistant', md)
    await fetchMessages(convId)
    await fetchConversations()
  }

  const sendingRef = useRef(false)

  const handleSend = async (text: string, files: File[]) => {
    if (!selectedModel) return
    // Guard against double-submit (double-click / Enter repeat):
    // concurrent sends race on shared state and orphan messages on screen
    if (sendingRef.current || generating) return
    sendingRef.current = true

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

      setMessages((prev) => [...prev, { ...newUserMessage, id: 'temp-user', conversation_id: conversationId || '', user_id: userId, created_at: new Date().toISOString() } as Message])

      // Special inline modes (precedence: Research > Compare > Image)
      if (modeResearch || modeCompare || modeImage) {
        conversationId = await ensureConversation(text)
        setMessages((prev) =>
          prev.map((m) => (m.id === 'temp-user' ? { ...m, conversation_id: conversationId as string } : m))
        )
        await saveMessageRow(conversationId, 'user', text)
        if (modeResearch) {
          await runResearchFlow(text, conversationId, controller.signal)
          return
        }
        if (modeCompare) {
          const second = compareModel && compareModel !== selectedModel
            ? compareModel
            : models.find((m) => m.id !== selectedModel && m.enabled)?.id || ''
          if (!second) throw new Error('ต้องการอย่างน้อย 2 โมเดลที่เปิดใช้สำหรับ Compare')
          await runCompareFlow(text, conversationId, controller.signal, second)
          return
        }
        await runImageFlow(text, conversationId)
        return
      }

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
          kbId: modeKb && kbId !== 'all' ? kbId : null,
          kbSearchAll: modeKb && kbId === 'all',
          systemPromptId: promptId || null,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to send message')
      }

      // Single-pass SSE read: content tokens + conversationId + done event
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const messageId = 'temp-' + Date.now()
      setMessages((prev) => [...prev, { id: messageId, conversation_id: conversationId || '', user_id: userId, role: 'assistant', content: '', model: selectedModel, created_at: new Date().toISOString() } as Message])

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let parsed: { content?: string; conversationId?: string; done?: boolean; error?: string }
          try {
            parsed = JSON.parse(line.slice(6))
          } catch {
            continue
          }
          if (parsed.error) throw new Error(parsed.error)
          if (parsed.content) {
            fullContent += parsed.content
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, content: fullContent } : m))
            )
          }
          if (parsed.conversationId && !conversationId) {
            conversationId = parsed.conversationId
            setCurrentConversationId(conversationId)
            // Replace optimistic ids so a later refetch/switch stays consistent
            setMessages((prev) =>
              prev.map((m) =>
                m.id === 'temp-user' || m.id === messageId
                  ? { ...m, conversation_id: conversationId as string }
                  : m
              )
            )
          }
          if (parsed.done) {
            // Server already saved both messages; reload authoritative state
            const rows = await fetchMessages(conversationId || '')
            await fetchConversations()
            // If the user's question didn't come back (transient read), retry once.
            // Never re-insert here: the server owns writes; re-inserting duplicates history.
            if (
              rows &&
              conversationId &&
              !rows.some((r) => r.role === 'user' && r.content === text)
            ) {
              console.warn('User message missing after refetch, retrying read once')
              await new Promise((res) => setTimeout(res, 1000))
              await fetchMessages(conversationId)
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
      sendingRef.current = false
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

  const activeStatusText = (features.web && webSearch)
    ? 'กำลังค้นหาข้อมูลจากอินเทอร์เน็ต...'
    : (features.kb && modeKb)
    ? 'กำลังค้นหาข้อมูลในคลังความรู้ (KB)...'
    : (features.research && modeResearch)
    ? 'กำลังค้นคว้าและวิเคราะห์เชิงลึก...'
    : undefined

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
        width={sidebarWidth}
      />
      {/* Draggable divider (desktop) */}
      <div
        onMouseDown={startResize}
        className="hidden lg:block w-1.5 flex-shrink-0 cursor-col-resize hover:bg-accent active:bg-accent transition-colors"
        title="ลากเพื่อปรับความกว้าง"
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
        <header className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2 bg-card flex-shrink-0">
          <MobileSidebarTrigger onClick={() => setSidebarOpen(true)} />
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            disabled={generating}
            className="flex-1 min-w-[160px] max-w-xs"
          />
          {features.web && (
            <Button variant={webSearch ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setWebSearch((v) => !v)} title="ค้นเว็บก่อนตอบ (ใช้ร่วมกับแชตปกติได้)">
              <Globe className="h-3.5 w-3.5 mr-1" />Web
            </Button>
          )}
          {features.research && (
            <Button variant={modeResearch ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setModeResearch((v) => !v)} title="รายงาน Deep Research ตอบในแชตนี้เลย">
              <Microscope className="h-3.5 w-3.5 mr-1" />Research
            </Button>
          )}
          {features.kb && (
            <>
              <Button variant={modeKb ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setModeKb((v) => !v)} title="ดึงความรู้จาก Knowledge Base มาตอบ">
                <BookOpen className="h-3.5 w-3.5 mr-1" />KB
              </Button>
              {modeKb && (
                <Select value={kbId} onValueChange={setKbId}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="คลัง" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกคลัง</SelectItem>
                    {kbList.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
          {features.compare && (
            <>
              <Button variant={modeCompare ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => {
                const next = !modeCompare
                setModeCompare(next)
                if (next && !compareModel) {
                  const other = models.find((m) => m.id !== selectedModel && m.enabled)
                  if (other) setCompareModel(other.id)
                }
              }} title="เทียบคำตอบ 2 โมเดลในแชตนี้เลย">
                <Columns2 className="h-3.5 w-3.5 mr-1" />Compare
              </Button>
              {modeCompare && (
                <Select value={compareModel} onValueChange={setCompareModel}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="คู่เทียบ" /></SelectTrigger>
                  <SelectContent>
                    {models.filter((m) => m.id !== selectedModel && m.enabled).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
          {features.image && (
            <Button variant={modeImage ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setModeImage((v) => !v)} title="สร้างภาพจากข้อความในแชตนี้เลย">
              <ImageIcon className="h-3.5 w-3.5 mr-1" />Image
            </Button>
          )}
          {features.prompts && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={promptId ? 'default' : 'outline'} size="sm" className="h-8 text-xs" title="เลือกพร้อมท์เสริมมาตอบ">
                  <ScrollText className="h-3.5 w-3.5 mr-1" />Prompts{promptId ? ' •' : ''}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-auto">
                <DropdownMenuItem onClick={() => setPromptId('')}>
                  <span className="text-muted-foreground">ไม่ใช้พร้อมท์</span>
                  {!promptId && <Check className="h-3.5 w-3.5 ml-auto" />}
                </DropdownMenuItem>
                {prompts.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => setPromptId(promptId === p.id ? '' : p.id)}>
                    <span className="truncate">{p.title}</span>
                    {promptId === p.id && <Check className="h-3.5 w-3.5 ml-auto flex-shrink-0" />}
                  </DropdownMenuItem>
                ))}
                {prompts.length === 0 && (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground text-xs">ยังไม่มีพร้อมท์ — เพิ่มที่หน้า Prompts</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {profile.role === 'admin' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 ml-auto flex-shrink-0"
              title="Admin Dashboard"
              onClick={() => router.push('/admin')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <ScrollArea className="flex-1 min-h-0">
            <div ref={chatContainerRef} className="flex flex-col items-stretch max-w-3xl mx-auto w-full gap-2 p-4 pt-8 pb-4">
              {messages.length === 0 && !currentConversationId && !convLoading && !convError && (
                <div className="text-center py-12 text-muted-foreground">
                  <h3 className="text-lg font-medium mb-2">Welcome to Family AI</h3>
                  <p className="text-sm">Start a new chat to begin</p>
                </div>
              )}
              {convLoading && messages.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">กำลังโหลดข้อความ...</span>
                </div>
              )}
              {convError && messages.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-destructive">{convError}</p>
                  <Button variant="outline" size="sm" onClick={() => currentConversationId && fetchMessages(currentConversationId)}>
                    ลองใหม่
                  </Button>
                </div>
              )}
              {messages.map((message) => (
                <MessageComponent
                  key={message.id}
                  message={message}
                  isStreaming={generating && message.id.startsWith('temp-')}
                  statusText={activeStatusText}
                  onRegenerate={message.role === 'assistant' ? () => handleRegenerate(message.id) : undefined}
                  onEdit={message.role === 'user' ? (content) => handleEdit(message.id, content) : undefined}
                  onCopy={handleCopy}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            disabled={generating}
            isGenerating={generating}
            statusText={activeStatusText}
          />
        </main>
      </div>
    </div>
  )
}