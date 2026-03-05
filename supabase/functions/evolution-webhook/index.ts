import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPT_OUT_KEYWORDS = ["parar", "sair", "cancelar", "remover", "stop", "unsubscribe"];

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const event = body.event;

    // Handle connection status updates
    if (event === "connection.update") {
      const instanceName = body.instance;
      const state = body.data?.state; // open, close, connecting
      if (instanceName && state) {
        const evoStatus = state === "open" ? "connected" : state === "close" ? "disconnected" : "connecting";
        await supabase
          .from("whatsapp_config")
          .update({ evolution_status: evoStatus })
          .eq("evolution_instance_name", instanceName);
      }
      return new Response("OK", { status: 200 });
    }

    // Handle incoming messages
    if (event === "messages.upsert") {
      const instanceName = body.instance;
      const data = body.data;

      if (!data) return new Response("OK", { status: 200 });

      // Evolution API sends message data
      const msg = data;
      const key = msg.key;
      if (!key || key.fromMe) return new Response("OK", { status: 200 });

      // Extract phone from remoteJid (format: 5511999999999@s.whatsapp.net)
      const remoteJid = key.remoteJid || "";
      const fromPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      if (!fromPhone) return new Response("OK", { status: 200 });

      const msgText = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || "";

      const messageId = key.id || null;

      // Normalize phone variants
      const phoneVariants = [`+${fromPhone}`, fromPhone];

      // Find the lead by phone
      const { data: lead } = await supabase
        .from("leads")
        .select("id, workspace_id")
        .or(phoneVariants.map((p) => `phone.eq.${p}`).join(","))
        .limit(1)
        .single();

      if (!lead) return new Response("OK", { status: 200 });

      // Save inbound message
      await supabase.from("messages").insert({
        workspace_id: lead.workspace_id,
        lead_id: lead.id,
        direction: "inbound",
        body: msgText,
        whatsapp_message_id: messageId,
        status: "received",
      });

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
            next_followup_at: null,
          })
          .eq("id", dispatch.id);
      }

      // Fire-and-forget: call classify-response for AI classification
      if (!isOptOut && msgText.trim()) {
        const classifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/classify-response`;
        fetch(classifyUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lead_id: lead.id,
            dispatch_id: dispatch?.id || null,
            message_body: msgText,
            workspace_id: lead.workspace_id,
          }),
        }).catch((err) => console.error("classify-response call failed:", err.message));
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("Evolution webhook error:", err.message);
    return new Response("OK", { status: 200 });
  }
});
