export type UserRole = 'admin' | 'user'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  avatar_url: string | null
  monthly_budget: number
  usage_current_month: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  model: string
  pinned: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model: string | null
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost: number | null
  created_at: string
}

export interface Attachment {
  id: string
  user_id: string
  conversation_id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  created_at: string
}

export interface Model {
  id: string
  provider_model_id: string
  display_name: string
  provider: string
  category: string
  supports_vision: boolean
  enabled: boolean
  estimated_input_cost: number
  estimated_output_cost: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UsageLog {
  id: string
  user_id: string
  conversation_id: string | null
  model: string
  request_type: 'chat' | 'vision' | 'file_analysis' | 'search' | 'research' | 'embedding' | 'image' | 'memory' | 'compare'
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  provider_request_id: string | null
  is_estimate: boolean
  created_at: string
}

export interface KnowledgeBase {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface KbDocument {
  id: string
  kb_id: string
  user_id: string
  file_name: string
  mime_type: string
  char_count: number
  chunk_count: number
  created_at: string
}

export interface PromptItem {
  id: string
  user_id: string
  title: string
  content: string
  category: string | null
  is_public: boolean
  created_at: string
}

export interface MemoryItem {
  id: string
  user_id: string
  content: string
  created_at: string
}

export interface ChatRequest {
  conversationId: string | null
  model: string
  messages: ChatMessage[]
  attachments?: Attachment[]
  stream?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | ChatMessageContent[]
}

export interface ChatMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export interface ChatResponse {
  id: string
  conversationId: string
  message: Message
  usage?: {
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }
}

export interface StreamChunk {
  content: string
  done: boolean
  usage?: {
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }
  error?: string
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  requestsToday: number
  requestsThisMonth: number
  estimatedCostThisMonth: number
}

export interface AdminUser {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  is_active: boolean
  monthly_budget: number
  current_usage: number
  request_count: number
  last_active: string | null
}