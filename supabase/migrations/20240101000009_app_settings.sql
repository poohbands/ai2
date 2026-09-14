-- App Settings table for global application configurations (like menu feature toggles)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow read for everyone (anon and authenticated)
CREATE POLICY " Allow public read on app_settings\
 ON public.app_settings FOR SELECT
 USING (true);

-- Allow write for admins and service_role
CREATE POLICY \Allow admin write on app_settings\
 ON public.app_settings FOR ALL
 USING (
 EXISTS (
 SELECT 1 FROM public.profiles
 WHERE id = auth.uid() AND role = 'admin'
 )
 );

-- Seed default menu features
INSERT INTO public.app_settings (key, value)
VALUES ('menu_features', '{\web\: true, \research\: true, \kb\: true, \compare\: true, \image\: true, \prompts\: true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
