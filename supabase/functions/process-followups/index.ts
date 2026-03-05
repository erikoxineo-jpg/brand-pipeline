import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify auth (service role or cron)
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader?.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    // Fetch dispatches with pending follow-ups
    const { data: dispatches, error: fetchErr } = await supabase
      .from("dispatches")
      .select("*, leads(name, phone, days_inactive, opt_out, workspace_id), campaigns(message_template, followup_enabled, followup_messages)")
      .lte("next_followup_at", new Date().toISOString())
      .in("status", ["sent", "delivered", "read"])
      .limit(50);

    if (fetchErr) throw fetchErr;
    if (!dispatches?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    let processed = 0;

    for (const dispatch of dispatches) {
      const lead = dispatch.leads as any;
      const campaign = dispatch.campaigns as any;

      // Skip if lead opted out or no phone
      if (!lead?.phone || lead.opt_out) {
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
        continue;
      }

      // Skip if follow-up not enabled
      if (!campaign?.followup_enabled) {
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
        continue;
      }

      const followupMessages = (campaign.followup_messages as any[]) || [];
      const currentIndex = dispatch.followup_index || 0;

      if (currentIndex >= followupMessages.length) {
        // No more follow-ups
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
        continue;
      }

      const followup = followupMessages[currentIndex];
      let message = followup?.template || "Olá, tudo bem?";

      // Get workspace name for {{marca}} variable
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", dispatch.workspace_id)
        .single();

      const brandName = workspace?.name || "nossa marca";

      // Replace template variables
      message = message.replace(/\{\{nome\}\}/g, lead.name || "");
      message = message.replace(/\{\{dias\}\}/g, String(lead.days_inactive || ""));
      message = message.replace(/\{\{marca\}\}/g, brandName);

      // Get WhatsApp config
      const { data: waConfig } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("workspace_id", dispatch.workspace_id)
        .single();

      if (!waConfig) {
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
        continue;
      }

      const provider = waConfig.provider || "meta";
      let waMessageId: string | null = null;

      try {
        if (provider === "evolution" && waConfig.evolution_instance_name) {
          const evoResponse = await fetch(
            `${EVOLUTION_API_URL}/message/sendText/${waConfig.evolution_instance_name}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
              body: JSON.stringify({
                number: lead.phone.replace(/\D/g, ""),
                text: message,
              }),
            }
          );
          const evoResult = await evoResponse.json();
          if (evoResponse.ok && evoResult.key?.id) {
            waMessageId = evoResult.key.id;
          }
        } else if (waConfig.phone_number_id && waConfig.access_token) {
          const waResponse = await fetch(
            `https://graph.facebook.com/v21.0/${waConfig.phone_number_id}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${waConfig.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: lead.phone.replace(/\D/g, ""),
                type: "text",
                text: { body: message },
              }),
            }
          );
          const waResult = await waResponse.json();
          if (waResponse.ok && waResult.messages?.[0]?.id) {
            waMessageId = waResult.messages[0].id;
          }
        }
      } catch (sendErr: any) {
        console.error("Follow-up send error:", sendErr.message);
      }

      if (waMessageId) {
        // Save outbound follow-up message
        await supabase.from("messages").insert({
          workspace_id: dispatch.workspace_id,
          lead_id: dispatch.lead_id,
          dispatch_id: dispatch.id,
          direction: "outbound",
          body: message,
          whatsapp_message_id: waMessageId,
          status: "sent",
        });

        const nextIndex = currentIndex + 1;
        if (nextIndex < followupMessages.length) {
          // Schedule next follow-up
          const nextFollowup = followupMessages[nextIndex];
          const delayDays = nextFollowup?.delay_days || 3;
          await supabase.from("dispatches").update({
            followup_index: nextIndex,
            next_followup_at: new Date(Date.now() + delayDays * 86400000).toISOString(),
          }).eq("id", dispatch.id);
        } else {
          // Last follow-up sent
          await supabase.from("dispatches").update({
            followup_index: nextIndex,
            next_followup_at: null,
          }).eq("id", dispatch.id);
        }

        processed++;
      } else {
        // Send failed, clear follow-up to avoid infinite retries
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 3000));
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Process followups error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
