-- ============================================================
-- CRM Tables for ReConnect
-- Creates: leads, imports, campaigns, dispatches, whatsapp_config
-- Plus: RLS policies and helper function
-- ============================================================

-- Helper function: check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

-- ============================================================
-- 1. LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  last_purchase DATE,
  days_inactive INT,
  stage TEXT NOT NULL DEFAULT 'imported',
  opt_out BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_leads_workspace ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(workspace_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(workspace_id, phone);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_leads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_leads_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select" ON public.leads
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE USING (public.is_workspace_member(workspace_id));
CREATE POLICY "leads_delete" ON public.leads
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 2. IMPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total INT NOT NULL DEFAULT 0,
  new_leads INT NOT NULL DEFAULT 0,
  duplicates INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imports_workspace ON public.imports(workspace_id);

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imports_select" ON public.imports
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "imports_insert" ON public.imports
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "imports_update" ON public.imports
  FOR UPDATE USING (public.is_workspace_member(workspace_id));
CREATE POLICY "imports_delete" ON public.imports
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 3. CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  message_template TEXT,
  survey_questions JSONB DEFAULT '[]',
  offer_type TEXT,
  offer_value TEXT,
  offer_rule TEXT,
  target_stages TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON public.campaigns(workspace_id);

CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_campaigns_updated_at();

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select" ON public.campaigns
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "campaigns_insert" ON public.campaigns
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "campaigns_update" ON public.campaigns
  FOR UPDATE USING (public.is_workspace_member(workspace_id));
CREATE POLICY "campaigns_delete" ON public.campaigns
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 4. DISPATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  whatsapp_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatches_workspace ON public.dispatches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_lead ON public.dispatches(lead_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_campaign ON public.dispatches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON public.dispatches(workspace_id, status);

ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatches_select" ON public.dispatches
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "dispatches_insert" ON public.dispatches
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "dispatches_update" ON public.dispatches
  FOR UPDATE USING (public.is_workspace_member(workspace_id));
CREATE POLICY "dispatches_delete" ON public.dispatches
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 5. WHATSAPP_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  verify_token TEXT,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

CREATE OR REPLACE FUNCTION public.update_whatsapp_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_whatsapp_config_updated_at();

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_config_select" ON public.whatsapp_config
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "whatsapp_config_insert" ON public.whatsapp_config
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "whatsapp_config_update" ON public.whatsapp_config
  FOR UPDATE USING (public.is_workspace_member(workspace_id));
CREATE POLICY "whatsapp_config_delete" ON public.whatsapp_config
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- Enable realtime for dispatches (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatches;
