import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dispatch_ids } = await req.json();
    if (!dispatch_ids?.length) {
      return new Response(JSON.stringify({ error: "No dispatch_ids provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch dispatches with lead and campaign data
    const { data: dispatches, error: fetchErr } = await supabase
      .from("dispatches")
      .select("*, leads(name, phone, days_inactive), campaigns(message_template, followup_enabled, followup_messages)")
      .in("id", dispatch_ids)
      .eq("status", "pending");

    if (fetchErr) throw fetchErr;
    if (!dispatches?.length) {
      return new Response(JSON.stringify({ error: "No pending dispatches found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workspace WhatsApp config
    const workspaceId = dispatches[0].workspace_id;
    const { data: waConfig, error: configErr } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    const provider = waConfig?.provider || "meta";

    if (provider === "meta" && (!waConfig?.phone_number_id || !waConfig?.access_token)) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured for this workspace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (provider === "evolution" && !waConfig?.evolution_instance_name) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Evolution API not configured for this workspace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (configErr) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured for this workspace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Get workspace name for {{marca}} variable
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    const brandName = workspace?.name || "nossa marca";
    const results: { id: string; status: string; error?: string }[] = [];

    // Rate limit: ~20/min → 3s delay between sends
    for (let i = 0; i < dispatches.length; i++) {
      const dispatch = dispatches[i];
      const lead = dispatch.leads as any;
      const campaign = dispatch.campaigns as any;

      if (!lead?.phone) {
        await supabase
          .from("dispatches")
          .update({ status: "failed", error_message: "No phone number" })
          .eq("id", dispatch.id);
        results.push({ id: dispatch.id, status: "failed", error: "No phone number" });
        continue;
      }

      // Replace template variables
      let message = campaign?.message_template || "Olá, sentimos sua falta!";
      message = message.replace(/\{\{nome\}\}/g, lead.name || "");
      message = message.replace(/\{\{dias\}\}/g, String(lead.days_inactive || ""));
      message = message.replace(/\{\{marca\}\}/g, brandName);

      try {
        let waMessageId: string | null = null;
        let sendError: string | null = null;

        if (provider === "evolution") {
          // Evolution API send
          const evoResponse = await fetch(
            `${EVOLUTION_API_URL}/message/sendText/${waConfig.evolution_instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: EVOLUTION_API_KEY,
              },
              body: JSON.stringify({
                number: lead.phone.replace(/\D/g, ""),
                text: message,
              }),
            }
          );

          const evoResult = await evoResponse.json();

          if (evoResponse.ok && evoResult.key?.id) {
            waMessageId = evoResult.key.id;
          } else {
            sendError = evoResult.message || evoResult.error || "Evolution API error";
          }
        } else {
          // Meta Cloud API send
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
          } else {
            sendError = waResult.error?.message || "WhatsApp API error";
          }
        }

        if (waMessageId) {
          await supabase
            .from("dispatches")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              whatsapp_message_id: waMessageId,
            })
            .eq("id", dispatch.id);

          // Save outbound message
          await supabase.from("messages").insert({
            workspace_id: workspaceId,
            lead_id: dispatch.lead_id,
            dispatch_id: dispatch.id,
            direction: "outbound",
            body: message,
            whatsapp_message_id: waMessageId,
            status: "sent",
          });

          // Schedule follow-up if enabled
          const followupMessages = campaign?.followup_messages as any[] || [];
          const followupIndex = dispatch.followup_index || 0;
          if (campaign?.followup_enabled && followupMessages.length > followupIndex) {
            const nextFollowup = followupMessages[followupIndex];
            const delayDays = nextFollowup?.delay_days || 3;
            await supabase.from("dispatches").update({
              next_followup_at: new Date(Date.now() + delayDays * 86400000).toISOString(),
              followup_index: followupIndex,
            }).eq("id", dispatch.id);
          }

          // Update lead stage to contacted
          await supabase
            .from("leads")
            .update({ stage: "contacted" })
            .eq("id", dispatch.lead_id)
            .in("stage", ["ready", "imported", "eligible"]);

          results.push({ id: dispatch.id, status: "sent" });
        } else {
          await supabase
            .from("dispatches")
            .update({ status: "failed", error_message: sendError })
            .eq("id", dispatch.id);
          results.push({ id: dispatch.id, status: "failed", error: sendError || "Unknown error" });
        }
      } catch (sendErr: any) {
        await supabase
          .from("dispatches")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", dispatch.id);
        results.push({ id: dispatch.id, status: "failed", error: sendErr.message });
      }

      // Rate limit delay (skip on last item)
      if (i < dispatches.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
