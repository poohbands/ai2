'use client'

import { Model } from '@/types'
import { Button } from '@/components/ui/button'
import { ChevronDown, Search, Sparkles, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

interface ModelSelectorProps {
  models: Model[]
  selectedModel: string
  onSelect: (modelId: string) => void
  disabled?: boolean
  className?: string
}

export function ModelSelector({ models, selectedModel, onSelect, disabled, className }: ModelSelectorProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (triggerRef.current?.contains(event.target as Node)) return
      if (contentRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const enabledModels = models.filter((m) => m.enabled)
  const filteredModels = enabledModels.filter((m) =>
    m.display_name.toLowerCase().includes(search.toLowerCase()) ||
    m.provider.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  )

  const selected = enabledModels.find((m) => m.id === selectedModel) || enabledModels[0]

  return (
    <div className={cn('relative', className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            className={cn(
              'w-full justify-between gap-2 h-9 px-3',
              'text-left text-sm'
            )}
            disabled={disabled || enabledModels.length === 0}
          >
            <div className="flex items-center gap-2 flex-1 truncate">
              {selected?.supports_vision && <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{selected?.display_name || 'Select model'}</span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          ref={contentRef}
          className="w-72 max-h-[400px] overflow-auto p-1"
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b border-border mb-1">
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
            </Input>
          </div>
          <DropdownMenuGroup>
            {filteredModels.length === 0 ? (
              <DropdownMenuLabel className="text-muted-foreground px-2 py-1">No models found</DropdownMenuLabel>
            ) : (
              filteredModels.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5',
                    model.id === selectedModel && 'bg-accent'
                  )}
                  onClick={() => {
                    onSelect(model.id)
                    setOpen(false)
                  }}
                  disabled={disabled}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {model.supports_vision && <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">{model.display_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{model.provider} • {model.category}</span>
                    </div>
                  </div>
                  {model.id === selectedModel && (
                    <span className="text-xs text-primary font-medium">Active</span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}