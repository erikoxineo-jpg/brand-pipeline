-- Messages table: stores outbound and inbound WhatsApp messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  dispatch_id UUID REFERENCES dispatches(id),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  body TEXT NOT NULL,
  whatsapp_message_id TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_lead ON messages(lead_id, created_at DESC);
CREATE INDEX idx_messages_workspace ON messages(workspace_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members can view messages"
  ON messages FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
