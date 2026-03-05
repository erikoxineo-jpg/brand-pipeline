-- Follow-up fields on campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_messages JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS followup_interval_days INTEGER DEFAULT 3;

-- Follow-up tracking on dispatches
ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS followup_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ;
