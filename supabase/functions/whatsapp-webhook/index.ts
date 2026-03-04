import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPT_OUT_KEYWORDS = ["parar", "sair", "cancelar", "remover", "stop", "unsubscribe"];

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET: Webhook verification (Meta challenge)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Verify token should match one stored in whatsapp_config
    // For simplicity, accept if mode is subscribe and token is present
    if (mode === "subscribe" && token && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST: Incoming webhook events
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) {
        return new Response("OK", { status: 200 });
      }

      // Handle status updates (delivered, read, failed)
      if (value.statuses) {
        for (const status of value.statuses) {
          const waMessageId = status.id;
          const statusName = status.status; // sent, delivered, read, failed

          if (!waMessageId) continue;

          const updateData: Record<string, any> = {};

          if (statusName === "delivered") {
            updateData.status = "delivered";
            updateData.delivered_at = new Date().toISOString();
          } else if (statusName === "read") {
            updateData.status = "read";
            updateData.read_at = new Date().toISOString();
          } else if (statusName === "failed") {
            updateData.status = "failed";
            updateData.error_message = status.errors?.[0]?.title || "Delivery failed";
          }

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from("dispatches")
              .update(updateData)
              .eq("whatsapp_message_id", waMessageId);
          }
        }
      }

      // Handle incoming messages (replies)
      if (value.messages) {
        for (const msg of value.messages) {
          const fromPhone = msg.from; // sender phone in international format
          const msgText = msg.text?.body || "";

          if (!fromPhone) continue;

          // Normalize phone: try +{fromPhone}
          const phoneVariants = [
            `+${fromPhone}`,
            fromPhone,
          ];

          // Find the lead by phone
          const { data: lead } = await supabase
            .from("leads")
            .select("id, workspace_id")
            .or(phoneVariants.map((p) => `phone.eq.${p}`).join(","))
            .limit(1)
            .single();

          if (!lead) continue;

          // Check opt-out
          const isOptOut = OPT_OUT_KEYWORDS.some((kw) =>
            msgText.toLowerCase().includes(kw)
          );

          if (isOptOut) {
            await supabase
              .from("leads")
              .update({ opt_out: true, stage: "optout" })
              .eq("id", lead.id);
          } else {
            // Update lead stage to replied
            await supabase
              .from("leads")
              .update({ stage: "replied" })
              .eq("id", lead.id)
              .in("stage", ["contacted", "ready"]);
          }

          // Find the most recent dispatch for this lead and mark as replied
          const { data: dispatch } = await supabase
            .from("dispatches")
            .select("id")
            .eq("lead_id", lead.id)
            .in("status", ["sent", "delivered", "read"])
            .order("sent_at", { ascending: false })
            .limit(1)
            .single();

          if (dispatch) {
            await supabase
              .from("dispatches")
              .update({
                status: "replied",
                replied_at: new Date().toISOString(),
              })
              .eq("id", dispatch.id);
          }
        }
      }

      return new Response("OK", { status: 200 });
    } catch (err: any) {
      console.error("Webhook error:", err.message);
      return new Response("OK", { status: 200 }); // Always return 200 to Meta
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
