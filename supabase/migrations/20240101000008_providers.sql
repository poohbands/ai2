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
