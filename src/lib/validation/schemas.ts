import { z } from 'zod'

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.union([
        z.string(),
        z.array(
          z.object({
            type: z.enum(['text', 'image_url']),
            text: z.string().optional(),
            image_url: z.object({ url: z.string().url() }).optional(),
          })
        ),
      ]),
    })
  ),
  attachments: z.array(z.string().uuid()).optional(),
  stream: z.boolean().default(true),
  // Phase 2 additions (all optional, backwards compatible)
  webSearch: z.boolean().optional().default(false),
  kbId: z.string().uuid().optional().nullable(),
  systemPromptId: z.string().uuid().optional().nullable(),
})

export const conversationCreateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  model: z.string().min(1),
})

export const conversationUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
})

export const messageEditSchema = z.object({
  content: z.string().min(1),
})

export const adminUserUpdateSchema = z.object({
  monthly_budget: z.number().min(0).max(10000).optional(),
  is_active: z.boolean().optional(),
  role: z.enum(['admin', 'user']).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(100).optional(),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
})

export const searchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  maxResults: z.number().min(1).max(10).optional().default(5),
})

export const researchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  model: z.string().min(1),
  conversationId: z.string().uuid().nullable().optional(),
  depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
  stream: z.boolean().optional().default(true),
})

export const kbCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const kbDocumentSchema = z.object({
  kbId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  content: z.string().min(1),
})

export const imageGenSchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  size: z.enum(['512x512', '1024x1024', '1024x1792', '1792x1024']).optional().default('1024x1024'),
  conversationId: z.string().uuid().nullable().optional(),
})

export const compareRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  models: z.array(z.string().min(1)).min(2).max(3),
})

export const promptCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  isPublic: z.boolean().optional().default(false),
})

export const providerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['openai-compatible', 'kob', 'deepseek', 'openrouter']),
  base_url: z.string().url(),
  api_key: z.string().min(8).max(500),
})

export const providerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  base_url: z.string().url().optional(),
  api_key: z.string().min(8).max(500).optional(),
  enabled: z.boolean().optional(),
})

export const adminModelUpdateSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  provider_id: z.string().uuid().nullable().optional(),
  estimated_input_cost: z.number().min(0).optional(),
  estimated_output_cost: z.number().min(0).optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
export type ConversationCreate = z.infer<typeof conversationCreateSchema>
export type ConversationUpdate = z.infer<typeof conversationUpdateSchema>
export type MessageEdit = z.infer<typeof messageEditSchema>
export type AdminUserUpdate = z.infer<typeof adminUserUpdateSchema>
export type LoginRequest = z.infer<typeof loginSchema>
export type RegisterRequest = z.infer<typeof registerSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>
export type SearchRequest = z.infer<typeof searchRequestSchema>
export type ResearchRequest = z.infer<typeof researchRequestSchema>
