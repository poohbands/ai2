-- Family AI one-shot setup (SAFE TO RE-RUN, run whole file in SQL Editor)
-- Paste entire file into Supabase SQL Editor and Run.

-- ========== 20240101000001_initial_schema.sql ==========
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  avatar_url TEXT,
  monthly_budget NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  usage_current_month NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost NUMERIC(10, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Models table
CREATE TABLE IF NOT EXISTS public.models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  supports_vision BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  estimated_input_cost NUMERIC(10, 6) NOT NULL DEFAULT 0.000001,
  estimated_output_cost NUMERIC(10, 6) NOT NULL DEFAULT 0.000002,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage logs table
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('chat', 'vision', 'file_analysis')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  provider_request_id TEXT,
  is_estimate BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON public.conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON public.attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_id ON public.attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created ON public.usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_models_enabled ON public.models(enabled) WHERE enabled = TRUE;

-- ========== 20240101000002_rls_policies.sql ==========
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Conversations policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
CREATE POLICY "Users can insert own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON public.messages;
CREATE POLICY "Users can insert messages in own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- Attachments policies
DROP POLICY IF EXISTS "Users can view own attachments" ON public.attachments;
CREATE POLICY "Users can view own attachments" ON public.attachments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own attachments" ON public.attachments;
CREATE POLICY "Users can insert own attachments" ON public.attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own attachments" ON public.attachments;
CREATE POLICY "Users can delete own attachments" ON public.attachments
  FOR DELETE USING (auth.uid() = user_id);

-- Models policies (read-only for users, admin can manage)
DROP POLICY IF EXISTS "Users can view enabled models" ON public.models;
CREATE POLICY "Users can view enabled models" ON public.models
  FOR SELECT USING (enabled = TRUE);

-- Usage logs policies
DROP POLICY IF EXISTS "Users can view own usage logs" ON public.usage_logs;
CREATE POLICY "Users can view own usage logs" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (using service role on server side)
-- Note: Admin operations should use service role client, not these policies

-- ========== 20240101000003_seed_models.sql ==========
-- Seed models (idempotent: removes dupes, inserts missing only)
DELETE FROM public.models a USING public.models b WHERE a.id > b.id AND a.provider_model_id = b.provider_model_id;
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'kob', 'Google', TRUE, TRUE, 1.25e-06, 5e-06, 10 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'gemini-1.5-pro');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'gemini-1.5-flash', 'Gemini 1.5 Flash', 'kob', 'Google', TRUE, TRUE, 7.5e-08, 3e-07, 20 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'gemini-1.5-flash');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'gemini-1.0-pro', 'Gemini 1.0 Pro', 'kob', 'Google', FALSE, TRUE, 5e-07, 1.5e-06, 30 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'gemini-1.0-pro');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'kob', 'Anthropic', TRUE, TRUE, 3e-06, 1.5e-05, 40 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'claude-3-5-sonnet-20241022');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 'kob', 'Anthropic', TRUE, TRUE, 1e-06, 5e-06, 50 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'claude-3-5-haiku-20241022');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'claude-3-opus-20240229', 'Claude 3 Opus', 'kob', 'Anthropic', TRUE, TRUE, 1.5e-05, 7.5e-05, 60 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'claude-3-opus-20240229');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'gpt-4o', 'GPT-4o', 'kob', 'OpenAI', TRUE, TRUE, 2.5e-06, 1e-05, 70 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'gpt-4o');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'gpt-4o-mini', 'GPT-4o Mini', 'kob', 'OpenAI', TRUE, TRUE, 1.5e-07, 6e-07, 80 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'gpt-4o-mini');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'gpt-4-turbo', 'GPT-4 Turbo', 'kob', 'OpenAI', TRUE, TRUE, 1e-05, 3e-05, 90 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'gpt-4-turbo');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'deepseek-chat', 'DeepSeek V3', 'kob', 'DeepSeek', FALSE, TRUE, 2.7e-07, 1.1e-06, 100 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'deepseek-chat');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'deepseek-reasoner', 'DeepSeek R1', 'kob', 'DeepSeek', FALSE, TRUE, 5.5e-07, 2.19e-06, 110 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'deepseek-reasoner');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'qwen-2.5-72b-instruct', 'Qwen 2.5 72B', 'kob', 'Alibaba', FALSE, TRUE, 4e-07, 4e-07, 120 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'qwen-2.5-72b-instruct');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'qwen-2.5-vl-72b-instruct', 'Qwen 2.5 VL 72B', 'kob', 'Alibaba', TRUE, TRUE, 8e-07, 8e-07, 130 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'qwen-2.5-vl-72b-instruct');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'glm-4', 'GLM-4', 'kob', 'Z.ai', FALSE, TRUE, 5e-07, 5e-07, 140 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'glm-4');
INSERT INTO public.models (provider_model_id, display_name, provider, category, supports_vision, enabled, estimated_input_cost, estimated_output_cost, sort_order) SELECT 'glm-4v', 'GLM-4V', 'kob', 'Z.ai', TRUE, TRUE, 1e-06, 1e-06, 150 WHERE NOT EXISTS (SELECT 1 FROM public.models WHERE provider_model_id = 'glm-4v');

-- ========== 20240101000004_updated_at_triggers.sql ==========
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS models_updated_at ON public.models;
CREATE TRIGGER models_updated_at
  BEFORE UPDATE ON public.models
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ========== 20240101000005_auth_trigger.sql ==========
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, monthly_budget, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'user',
    10.00,
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== 20240101000006_phase2_rag_memory.sql ==========
-- Phase 2: pgvector + Knowledge Base + Memory + Prompts + Images + extended usage types

CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge bases
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kb_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kb_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Long-term memory (user-scoped facts)
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompt library
CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated images metadata
CREATE TABLE IF NOT EXISTS public.generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  storage_path TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend usage_logs request_type to Phase 2 values
ALTER TABLE public.usage_logs DROP CONSTRAINT IF EXISTS usage_logs_request_type_check;
ALTER TABLE public.usage_logs ADD CONSTRAINT usage_logs_request_type_check
  CHECK (request_type IN ('chat','vision','file_analysis','search','research','embedding','image','memory','compare'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kb_user ON public.knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_kb ON public.kb_documents(kb_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb ON public.kb_chunks(kb_id);
CREATE INDEX IF NOT EXISTS idx_memories_user ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_public ON public.prompts(is_public) WHERE is_public = TRUE;

-- RLS
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own kb" ON public.knowledge_bases;
CREATE POLICY "Users own kb" ON public.knowledge_bases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own kb docs" ON public.kb_documents;
CREATE POLICY "Users own kb docs" ON public.kb_documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own kb chunks" ON public.kb_chunks;
CREATE POLICY "Users own kb chunks" ON public.kb_chunks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own memories" ON public.memories;
CREATE POLICY "Users own memories" ON public.memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own prompts + public read" ON public.prompts;
CREATE POLICY "Users own prompts + public read" ON public.prompts FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);
DROP POLICY IF EXISTS "Users write own prompts" ON public.prompts;
CREATE POLICY "Users write own prompts" ON public.prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own prompts" ON public.prompts;
CREATE POLICY "Users update own prompts" ON public.prompts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own prompts" ON public.prompts;
CREATE POLICY "Users delete own prompts" ON public.prompts FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own images" ON public.generated_images;
CREATE POLICY "Users own images" ON public.generated_images FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ========== 20240101000007_vector_rpc.sql ==========
-- Vector similarity RPC for RAG
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  p_kb_id UUID,
  p_user_id UUID,
  p_embedding TEXT,
  p_top_k INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.content,
    1 - (c.embedding <=> p_embedding::vector) AS similarity
  FROM public.kb_chunks c
  WHERE c.kb_id = p_kb_id AND c.user_id = p_user_id AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_embedding::vector
  LIMIT p_top_k;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_memories(
  p_user_id UUID,
  p_embedding TEXT,
  p_top_k INT DEFAULT 5
)
RETURNS TABLE (id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.content,
    1 - (m.embedding <=> p_embedding::vector) AS similarity
  FROM public.memories m
  WHERE m.user_id = p_user_id AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_embedding::vector
  LIMIT p_top_k;
END;
$$;


-- ========== 20240101000008_providers.sql ==========
-- Phase 2b: multi-provider API keys (managed from Admin UI)
-- Keys stored AES-256-GCM encrypted in api_key_encrypted.
-- No public RLS policies: only service_role (server) can read.

CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'openai-compatible'
    CHECK (type IN ('openai-compatible', 'kob', 'deepseek', 'openrouter')),
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  key_hint TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.models ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_models_provider ON public.models(provider_id);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: app access via service_role only.


-- ========== 20240101000009_approval.sql ==========
-- Phase 2c: admin approval workflow for new signups
-- Flow: signup -> confirm email -> pending (is_approved=false, is_active=false)
--   -> admin approves (is_approved=true, is_active=true) -> can use app

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Existing active users (incl. current admins) stay approved
UPDATE public.profiles SET is_approved = TRUE, approved_at = NOW() WHERE is_active = TRUE AND is_approved = FALSE;

-- New signups start unapproved AND inactive
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, monthly_budget, is_active, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'user',
    10.00,
    FALSE,
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========== Storage: chat-files bucket + policies ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can upload own files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own files" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========== App Settings: menu_features & global configs ==========
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on app_settings" ON public.app_settings;
CREATE POLICY "Allow public read on app_settings" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin write on app_settings" ON public.app_settings;
CREATE POLICY "Allow admin write on app_settings" ON public.app_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.app_settings (key, value)
VALUES ('menu_features', '{"web": true, "research": true, "kb": true, "compare": true, "image": true, "prompts": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;