-- AI approval queue: add review/auto-send workflow to dispatches and campaigns

-- New fields on dispatches for AI response review
ALTER TABLE dispatches
  ADD COLUMN IF NOT EXISTS ai_suggested_response TEXT,
  ADD COLUMN IF NOT EXISTS ai_response_status TEXT,
  ADD COLUMN IF NOT EXISTS ai_response_sent TEXT,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_reviewed_by UUID REFERENCES auth.users(id);

-- New fields on campaigns for auto-respond mode
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS auto_respond_mode TEXT DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS auto_respond_auto_classes TEXT[] DEFAULT '{}';

-- Index for fast pending review queries
CREATE INDEX IF NOT EXISTS idx_dispatches_ai_pending
  ON dispatches (workspace_id, ai_response_status)
  WHERE ai_response_status = 'pending_review';
