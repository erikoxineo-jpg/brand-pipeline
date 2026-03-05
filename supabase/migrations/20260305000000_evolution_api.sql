-- Add Evolution API columns to whatsapp_config
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta' CHECK (provider IN ('evolution', 'meta')),
  ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT,
  ADD COLUMN IF NOT EXISTS evolution_phone TEXT,
  ADD COLUMN IF NOT EXISTS evolution_status TEXT DEFAULT 'close';
