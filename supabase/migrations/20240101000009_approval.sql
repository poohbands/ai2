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
