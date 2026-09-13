'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  History,
  Pin,
  PinOff,
  Archive,
  Trash2,
  Edit2,
  LogOut,
  User,
  Settings,
  ChevronLeft,
  X,
} from 'lucide-react'
import { Conversation } from '@/types'
import { formatRelativeTime } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

interface SidebarProps {
  conversations: Conversation[]
  currentConversationId: string | null
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  onTogglePin: (id: string) => void
  onToggleArchive: (id: string) => void
  user: {
    email: string
    display_name: string | null
    avatar_url: string | null
  }
  onLogout: () => void
  isMobile: boolean
  onCloseMobile: () => void
}

export function Sidebar({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  onToggleArchive,
  user,
  onLogout,
  isMobile,
  onCloseMobile,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pinned = filteredConversations.filter((c) => c.pinned && !c.archived)
  const regular = filteredConversations.filter((c) => !c.pinned && !c.archived)
  const archived = filteredConversations.filter((c) => c.archived)

  const handleRenameStart = (conv: Conversation) => {
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }

  const handleRenameConfirm = (id: string) => {
    if (renameValue.trim() && renameValue.trim() !== conversations.find((c) => c.id === id)?.title) {
      onRenameConversation(id, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') handleRenameConfirm(id)
    if (e.key === 'Escape') {
      setRenamingId(null)
      setRenameValue('')
    }
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-card border-r border-border transition-transform duration-200 ease-in-out',
        isMobile
          ? 'fixed left-0 top-0 z-50 w-80 shadow-xl'
          : 'hidden lg:flex'
      )}
    >
      {!isMobile && (
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Chats</h2>
        </div>
      )}

      <div className="p-3 border-b border-border">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
      </div>

      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {pinned.length > 0 && (
            <>
              <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pinned
              </DropdownMenuLabel>
              {pinned.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={currentConversationId === conv.id}
                  onSelect={onSelectConversation}
                  onDelete={onDeleteConversation}
                  onRename={handleRenameStart}
                  onTogglePin={onTogglePin}
                  onToggleArchive={onToggleArchive}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameConfirm={handleRenameConfirm}
                  onRenameCancel={() => setRenamingId(null)}
                  onKeyDown={handleKeyDown}
                />
              ))}
            </>
          )}

          {regular.length > 0 && (
            <>
              {pinned.length > 0 && (
                <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  History
                </DropdownMenuLabel>
              )}
              {regular.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={currentConversationId === conv.id}
                  onSelect={onSelectConversation}
                  onDelete={onDeleteConversation}
                  onRename={handleRenameStart}
                  onTogglePin={onTogglePin}
                  onToggleArchive={onToggleArchive}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameConfirm={handleRenameConfirm}
                  onRenameCancel={() => setRenamingId(null)}
                  onKeyDown={handleKeyDown}
                />
              ))}
            </>
          )}

          {archived.length > 0 && (
            <>
              <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Archived
              </DropdownMenuLabel>
              {archived.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={currentConversationId === conv.id}
                  onSelect={onSelectConversation}
                  onDelete={onDeleteConversation}
                  onRename={handleRenameStart}
                  onTogglePin={onTogglePin}
                  onToggleArchive={onToggleArchive}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onRenameConfirm={handleRenameConfirm}
                  onRenameCancel={() => setRenamingId(null)}
                  onKeyDown={handleKeyDown}
                />
              ))}
            </>
          )}

          {conversations.length === 0 && (
            <div className="px-2 py-8 text-center text-muted-foreground text-sm">
              No conversations yet. Start a new chat!
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />
      <div className="p-3 space-y-2">
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  )
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
  onToggleArchive,
  renamingId,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onKeyDown,
}: {
  conversation: Conversation
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (conv: Conversation) => void
  onTogglePin: (id: string) => void
  onToggleArchive: (id: string) => void
  renamingId: string | null
  renameValue: string
  onRenameChange: (value: string) => void
  onRenameConfirm: (id: string) => void
  onRenameCancel: () => void
  onKeyDown: (e: React.KeyboardEvent, id: string) => void
}) {
  const isRenaming = renamingId === conversation.id

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={() => onSelect(conversation.id)}
          className={cn(
            'w-full px-2 py-2 rounded-lg text-left transition-colors',
            'hover:bg-accent',
            isActive ? 'bg-accent' : '',
            conversation.archived && 'opacity-60'
          )}
        >
          <div className="flex items-start gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              {isRenaming ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => onRenameChange(e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, conversation.id)}
                  onBlur={() => onRenameConfirm(conversation.id)}
                  autoFocus
                  className="w-full px-1 py-0.5 text-sm border border-input rounded bg-background outline-none"
                />
              ) : (
                <p className="truncate text-sm font-medium">{conversation.title}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">
                {formatRelativeTime(conversation.updated_at)}
              </p>
            </div>
            {conversation.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onClick={() => onRename(conversation)}>
          <Edit2 className="h-3.5 w-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onTogglePin(conversation.id)}>
          {conversation.pinned ? (
            <>
              <PinOff className="h-3.5 w-3.5" />
              Unpin
            </>
          ) : (
            <>
              <Pin className="h-3.5 w-3.5" />
              Pin
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleArchive(conversation.id)}>
          {conversation.archived ? (
            <>
              <History className="h-3.5 w-3.5" />
              Unarchive
            </>
          ) : (
            <>
              <Archive className="h-3.5 w-3.5" />
              Archive
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(conversation.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MobileSidebarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClick}>
      <ChevronLeft className="h-5 w-5" />
    </Button>
  )
}

export function MobileSidebarOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 lg:hidden"
      onClick={onClose}
      aria-hidden="true"
    />
  )
}