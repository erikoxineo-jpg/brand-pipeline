import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify auth (service role only)
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader?.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Evolution API config
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://reconnect.oxineo.com.br/api/evolution";
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

  const results = {
    dispatches_created: 0,
    messages_sent: 0,
    followups_sent: 0,
    errors: [] as string[],
  };

  try {
    // ========================================
    // STEP 1: Auto-create dispatches
    // ========================================
    const { data: activeCampaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "active")
      .eq("auto_dispatch", true);

    for (const campaign of activeCampaigns || []) {
      try {
        const targetStages = campaign.target_stages || ["eligible", "ready"];
        const maxDaily = campaign.max_daily_dispatches || 100;

        // Count dispatches already created today for this campaign
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count: todayCount } = await supabase
          .from("dispatches")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaign.id)
          .gte("created_at", todayStart.toISOString());

        const remaining = maxDaily - (todayCount || 0);
        if (remaining <= 0) continue;

        // Get existing dispatch lead_ids for this campaign
        const { data: existingDispatches } = await supabase
          .from("dispatches")
          .select("lead_id")
          .eq("campaign_id", campaign.id);

        const existingLeadIds = new Set((existingDispatches || []).map((d) => d.lead_id));

        // Fetch eligible leads
        const { data: eligibleLeads } = await supabase
          .from("leads")
          .select("id")
          .eq("workspace_id", campaign.workspace_id)
          .eq("opt_out", false)
          .in("stage", targetStages)
          .limit(remaining);

        const newLeads = (eligibleLeads || []).filter((l) => !existingLeadIds.has(l.id));

        // Create dispatches in chunks of 500
        for (let i = 0; i < newLeads.length; i += 500) {
          const chunk = newLeads.slice(i, i + 500);
          const inserts = chunk.map((l) => ({
            workspace_id: campaign.workspace_id,
            lead_id: l.id,
            campaign_id: campaign.id,
            status: "pending",
          }));

          const { error: insertErr } = await supabase.from("dispatches").insert(inserts);
          if (insertErr) {
            results.errors.push(`Insert dispatches: ${insertErr.message}`);
          } else {
            results.dispatches_created += chunk.length;
          }
        }
      } catch (err: any) {
        results.errors.push(`Campaign ${campaign.id}: ${err.message}`);
      }
    }

    // ========================================
    // STEP 2: Auto-send pending dispatches
    // ========================================
    const { data: pendingDispatches } = await supabase
      .from("dispatches")
      .select("*, leads(name, phone, days_inactive), campaigns(message_template, followup_enabled, followup_messages, workspace_id)")
      .eq("status", "pending")
      .not("campaign_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(50);

    // Only send dispatches from active campaigns
    const activeCampaignIds = new Set((activeCampaigns || []).map((c) => c.id));
    const toSend = (pendingDispatches || []).filter((d) => activeCampaignIds.has(d.campaign_id));

    // Cache workspace configs and names
    const wsConfigCache: Record<string, any> = {};
    const wsNameCache: Record<string, string> = {};

    for (let i = 0; i < toSend.length; i++) {
      const dispatch = toSend[i];
      const lead = dispatch.leads as any;
      const campaign = dispatch.campaigns as any;
      const workspaceId = dispatch.workspace_id;

      if (!lead?.phone) {
        await supabase
          .from("dispatches")
          .update({ status: "failed", error_message: "No phone number" })
          .eq("id", dispatch.id);
        continue;
      }

      try {
        // Get workspace config (cached)
        if (!wsConfigCache[workspaceId]) {
          const { data: waConfig } = await supabase
            .from("whatsapp_config")
            .select("*")
            .eq("workspace_id", workspaceId)
            .single();
          wsConfigCache[workspaceId] = waConfig;
        }

        if (!wsNameCache[workspaceId]) {
          const { data: ws } = await supabase
            .from("workspaces")
            .select("name")
            .eq("id", workspaceId)
            .single();
          wsNameCache[workspaceId] = ws?.name || "nossa marca";
        }

        const waConfig = wsConfigCache[workspaceId];
        if (!waConfig) {
          await supabase
            .from("dispatches")
            .update({ status: "failed", error_message: "WhatsApp not configured" })
            .eq("id", dispatch.id);
          continue;
        }

        const provider = waConfig.provider || "meta";
        const brandName = wsNameCache[workspaceId];

        // Replace template variables
        let message = campaign?.message_template || "Olá, sentimos sua falta!";
        message = message.replace(/\{\{nome\}\}/g, lead.name || "");
        message = message.replace(/\{\{dias\}\}/g, String(lead.days_inactive || ""));
        message = message.replace(/\{\{marca\}\}/g, brandName);

        let waMessageId: string | null = null;
        let sendError: string | null = null;

        if (provider === "evolution" && waConfig.evolution_instance_name) {
          const evoResponse = await fetch(
            `${EVOLUTION_API_URL}/message/sendText/${waConfig.evolution_instance_name}`,
            {
              method: "POST",
              headers: EVOLUTION_API_KEY ? { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY } : { "Content-Type": "application/json" },
              body: JSON.stringify({
                number: lead.phone.replace(/\D/g, ""),
                text: message,
              }),
            }
          );
          const evoText = await evoResponse.text();
          let evoResult: any;
          try { evoResult = JSON.parse(evoText); } catch { evoResult = null; }
          if (evoResponse.ok && evoResult?.key?.id) {
            waMessageId = evoResult.key.id;
          } else {
            sendError = evoResult?.message || evoResult?.error || `Evolution API error (${evoResponse.status})`;
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
          } else {
            sendError = waResult.error?.message || "WhatsApp API error";
          }
        } else {
          sendError = "WhatsApp provider not properly configured";
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
          const followupMessages = (campaign?.followup_messages as any[]) || [];
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

          results.messages_sent++;
        } else {
          await supabase
            .from("dispatches")
            .update({ status: "failed", error_message: sendError })
            .eq("id", dispatch.id);
        }
      } catch (sendErr: any) {
        await supabase
          .from("dispatches")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", dispatch.id);
        results.errors.push(`Send ${dispatch.id}: ${sendErr.message}`);
      }

      // Rate limit delay (skip on last item)
      if (i < toSend.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    // ========================================
    // STEP 3: Process follow-ups
    // ========================================
    const { data: followupDispatches } = await supabase
      .from("dispatches")
      .select("*, leads(name, phone, days_inactive, opt_out, workspace_id), campaigns(message_template, followup_enabled, followup_messages)")
      .lte("next_followup_at", new Date().toISOString())
      .in("status", ["sent", "delivered", "read"])
      .limit(50);

    for (const dispatch of followupDispatches || []) {
      const lead = dispatch.leads as any;
      const campaign = dispatch.campaigns as any;

      // Skip if lead opted out or no phone
      if (!lead?.phone || lead.opt_out) {
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
        continue;
      }

      if (!campaign?.followup_enabled) {
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
        continue;
      }

      const followupMessages = (campaign.followup_messages as any[]) || [];
      const currentIndex = dispatch.followup_index || 0;

      if (currentIndex >= followupMessages.length) {
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
        continue;
      }

      const followup = followupMessages[currentIndex];
      let message = followup?.template || "Olá, tudo bem?";

      // Get workspace name
      if (!wsNameCache[dispatch.workspace_id]) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("name")
          .eq("id", dispatch.workspace_id)
          .single();
        wsNameCache[dispatch.workspace_id] = ws?.name || "nossa marca";
      }
      const brandName = wsNameCache[dispatch.workspace_id];

      message = message.replace(/\{\{nome\}\}/g, lead.name || "");
      message = message.replace(/\{\{dias\}\}/g, String(lead.days_inactive || ""));
      message = message.replace(/\{\{marca\}\}/g, brandName);

      // Get WhatsApp config
      if (!wsConfigCache[dispatch.workspace_id]) {
        const { data: waConfig } = await supabase
          .from("whatsapp_config")
          .select("*")
          .eq("workspace_id", dispatch.workspace_id)
          .single();
        wsConfigCache[dispatch.workspace_id] = waConfig;
      }

      const waConfig = wsConfigCache[dispatch.workspace_id];
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
              headers: EVOLUTION_API_KEY ? { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY } : { "Content-Type": "application/json" },
              body: JSON.stringify({
                number: lead.phone.replace(/\D/g, ""),
                text: message,
              }),
            }
          );
          const evoText = await evoResponse.text();
          let evoResult: any;
          try { evoResult = JSON.parse(evoText); } catch { evoResult = null; }
          if (evoResponse.ok && evoResult?.key?.id) {
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
          const nextFollowup = followupMessages[nextIndex];
          const delayDays = nextFollowup?.delay_days || 3;
          await supabase.from("dispatches").update({
            followup_index: nextIndex,
            next_followup_at: new Date(Date.now() + delayDays * 86400000).toISOString(),
          }).eq("id", dispatch.id);
        } else {
          await supabase.from("dispatches").update({
            followup_index: nextIndex,
            next_followup_at: null,
          }).eq("id", dispatch.id);
        }

        results.followups_sent++;
      } else {
        await supabase.from("dispatches").update({ next_followup_at: null }).eq("id", dispatch.id);
      }

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 3000));
    }

    console.log("Campaign engine results:", JSON.stringify(results));

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Campaign engine error:", err.message);
    return new Response(JSON.stringify({ error: err.message, ...results }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
