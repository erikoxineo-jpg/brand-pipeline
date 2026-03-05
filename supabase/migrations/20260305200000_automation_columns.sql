-- ============================================
-- Automation columns for autonomous campaigns
-- ============================================

-- Campaigns: automation settings
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_dispatch BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_respond BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_respond_context TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS max_daily_dispatches INTEGER DEFAULT 100;

-- Dispatches: AI classification
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS ai_classification TEXT;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS ai_confidence REAL;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Leads: consolidated AI classification
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_classification TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Cron: campaign-engine every 5 minutes
-- NOTE: Replace SERVICE_ROLE_KEY_AQUI with actual service role key when running in SQL Editor
SELECT cron.schedule(
  'campaign-engine',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://xbmhfijiljrwnifeqmei.supabase.co/functions/v1/campaign-engine',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

-- Cron: process-followups every hour
SELECT cron.schedule(
  'process-followups',
  '0 * * * *',
  $$SELECT net.http_post(
    url := 'https://xbmhfijiljrwnifeqmei.supabase.co/functions/v1/process-followups',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
