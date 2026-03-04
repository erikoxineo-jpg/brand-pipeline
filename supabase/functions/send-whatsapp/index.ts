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
      .select("*, leads(name, phone, days_inactive), campaigns(message_template)")
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

    if (configErr || !waConfig?.phone_number_id || !waConfig?.access_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured for this workspace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          await supabase
            .from("dispatches")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              whatsapp_message_id: waResult.messages[0].id,
            })
            .eq("id", dispatch.id);

          // Update lead stage to contacted
          await supabase
            .from("leads")
            .update({ stage: "contacted" })
            .eq("id", dispatch.lead_id)
            .in("stage", ["ready", "imported", "eligible"]);

          results.push({ id: dispatch.id, status: "sent" });
        } else {
          const errorMsg = waResult.error?.message || "WhatsApp API error";
          await supabase
            .from("dispatches")
            .update({ status: "failed", error_message: errorMsg })
            .eq("id", dispatch.id);
          results.push({ id: dispatch.id, status: "failed", error: errorMsg });
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
