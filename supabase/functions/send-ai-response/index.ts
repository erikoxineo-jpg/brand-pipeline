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

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate JWT from user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service role client for DB operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { dispatch_id, response_text, action } = await req.json();

    if (!dispatch_id || !action || !["approve", "edit", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Missing dispatch_id or invalid action (approve|edit|reject)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch dispatch
    const { data: dispatch, error: fetchErr } = await supabase
      .from("dispatches")
      .select("*, leads(name, phone)")
      .eq("id", dispatch_id)
      .single();

    if (fetchErr || !dispatch) {
      return new Response(JSON.stringify({ error: "Dispatch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dispatch.ai_response_status !== "pending_review") {
      return new Response(JSON.stringify({ error: "Dispatch is not pending review" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REJECT
    if (action === "reject") {
      await supabase
        .from("dispatches")
        .update({
          ai_response_status: "rejected",
          ai_reviewed_at: new Date().toISOString(),
          ai_reviewed_by: user.id,
        })
        .eq("id", dispatch_id);

      return new Response(JSON.stringify({ success: true, action: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // APPROVE or EDIT
    const textToSend = action === "edit" && response_text
      ? response_text
      : dispatch.ai_suggested_response;

    if (!textToSend) {
      return new Response(JSON.stringify({ error: "No response text to send" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadPhone = (dispatch as any).leads?.phone;
    if (!leadPhone) {
      return new Response(JSON.stringify({ error: "Lead has no phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp config
    const { data: waConfig } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("workspace_id", dispatch.workspace_id)
      .single();

    if (!waConfig) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = waConfig.provider || "meta";
    let waMessageId: string | null = null;

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://reconnect.oxineo.com.br/api/evolution";
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    if (provider === "evolution" && waConfig.evolution_instance_name) {
      const evoHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (EVOLUTION_API_KEY) evoHeaders["apikey"] = EVOLUTION_API_KEY;
      const evoResponse = await fetch(
        `${EVOLUTION_API_URL}/message/sendText/${waConfig.evolution_instance_name}`,
        {
          method: "POST",
          headers: evoHeaders,
          body: JSON.stringify({
            number: leadPhone.replace(/\D/g, ""),
            text: textToSend,
          }),
        }
      );
      const evoText = await evoResponse.text();
      let evoResult: any;
      try { evoResult = JSON.parse(evoText); } catch { evoResult = null; }
      if (evoResponse.ok && evoResult?.key?.id) {
        waMessageId = evoResult.key.id;
      } else {
        return new Response(JSON.stringify({ error: "Failed to send via Evolution API", detail: evoText }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
            to: leadPhone.replace(/\D/g, ""),
            type: "text",
            text: { body: textToSend },
          }),
        }
      );
      const waResult = await waResponse.json();
      if (waResponse.ok && waResult.messages?.[0]?.id) {
        waMessageId = waResult.messages[0].id;
      } else {
        return new Response(JSON.stringify({ error: "Failed to send via Meta API", detail: waResult }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "No WhatsApp provider configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save message record
    if (waMessageId) {
      await supabase.from("messages").insert({
        workspace_id: dispatch.workspace_id,
        lead_id: dispatch.lead_id,
        dispatch_id: dispatch_id,
        direction: "outbound",
        body: textToSend,
        whatsapp_message_id: waMessageId,
        status: "sent",
      });
    }

    // Update dispatch
    await supabase
      .from("dispatches")
      .update({
        ai_response_status: action === "edit" ? "edited" : "approved",
        ai_response_sent: textToSend,
        ai_reviewed_at: new Date().toISOString(),
        ai_reviewed_by: user.id,
      })
      .eq("id", dispatch_id);

    return new Response(JSON.stringify({ success: true, action, whatsapp_message_id: waMessageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-ai-response error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
