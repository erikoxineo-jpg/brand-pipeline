import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify auth
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader?.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500 });
  }

  try {
    const { lead_id, dispatch_id, message_body, workspace_id } = await req.json();

    if (!lead_id || !message_body) {
      return new Response(JSON.stringify({ error: "Missing lead_id or message_body" }), { status: 400 });
    }

    // Fetch lead info
    const { data: lead } = await supabase
      .from("leads")
      .select("name, phone, stage")
      .eq("id", lead_id)
      .single();

    // Fetch dispatch + campaign info
    let campaignTemplate = "";
    let autoRespondContext = "";
    let autoRespond = false;
    let campaignId: string | null = null;

    if (dispatch_id) {
      const { data: dispatch } = await supabase
        .from("dispatches")
        .select("campaign_id, campaigns(message_template, auto_respond, auto_respond_context)")
        .eq("id", dispatch_id)
        .single();

      if (dispatch) {
        const campaign = dispatch.campaigns as any;
        campaignId = dispatch.campaign_id;
        campaignTemplate = campaign?.message_template || "";
        autoRespond = campaign?.auto_respond || false;
        autoRespondContext = campaign?.auto_respond_context || "";
      }
    }

    // Fetch recent messages (last 5)
    const { data: recentMsgs } = await supabase
      .from("messages")
      .select("direction, body, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentMessages = (recentMsgs || [])
      .reverse()
      .map((m) => `[${m.direction === "outbound" ? "Bot" : "Cliente"}] ${m.body}`)
      .join("\n");

    // Call Claude API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Você é um classificador de respostas de clientes para uma campanha de reativação via WhatsApp.

Contexto da campanha: ${campaignTemplate}
${autoRespondContext ? `Contexto do negócio: ${autoRespondContext}` : ""}
Nome do cliente: ${lead?.name || "Desconhecido"}
Histórico recente:
${recentMessages}

Mensagem recebida: "${message_body}"

Classifique em JSON:
{
  "classification": "positive|negative|question|opt_out|greeting|other",
  "confidence": 0.0-1.0,
  "summary": "resumo curto em português",
  "suggested_response": "resposta sugerida se auto_respond ativo, null se não aplicável",
  "should_auto_respond": true|false,
  "new_stage": "replied|reactivated|optout"
}

Regras:
- positive: cliente demonstra interesse, quer saber mais, aceita oferta
- negative: cliente não tem interesse, recusa educadamente
- question: cliente tem dúvida sobre produto/serviço/oferta
- opt_out: cliente pede para parar de receber mensagens (parar, sair, cancelar, etc)
- greeting: saudação simples (oi, olá, bom dia)
- other: não se encaixa nas categorias acima
- new_stage: "reactivated" se positive com alta confiança, "optout" se opt_out, "replied" nos demais
- should_auto_respond: true para question, greeting, positive; false para negative, other
- Retorne APENAS o JSON, sem nenhum texto antes ou depois`,
        }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", errText);
      return new Response(JSON.stringify({ error: "Claude API error" }), { status: 500 });
    }

    const claudeResult = await claudeResponse.json();
    const content = claudeResult.content?.[0]?.text || "";

    // Parse JSON from Claude's response
    let classification: any;
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      classification = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Failed to parse Claude response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse classification" }), { status: 500 });
    }

    // Update dispatch with AI classification
    if (dispatch_id) {
      await supabase
        .from("dispatches")
        .update({
          ai_classification: classification.classification,
          ai_confidence: classification.confidence,
          ai_summary: classification.summary,
        })
        .eq("id", dispatch_id);
    }

    // Update lead with AI classification and stage
    const leadUpdate: any = {
      ai_classification: classification.classification,
      ai_summary: classification.summary,
    };

    if (classification.new_stage === "optout") {
      leadUpdate.stage = "optout";
      leadUpdate.opt_out = true;
    } else if (classification.new_stage === "reactivated" && classification.confidence >= 0.7) {
      leadUpdate.stage = "reactivated";
    }
    // "replied" stage was already set by the webhook, no need to downgrade

    await supabase.from("leads").update(leadUpdate).eq("id", lead_id);

    // Nullify follow-ups if opt_out
    if (classification.new_stage === "optout" && dispatch_id) {
      await supabase
        .from("dispatches")
        .update({ next_followup_at: null })
        .eq("id", dispatch_id);
    }

    // Auto-respond if enabled
    if (
      classification.should_auto_respond &&
      autoRespond &&
      classification.suggested_response &&
      classification.classification !== "opt_out"
    ) {
      // Get WhatsApp config
      const { data: waConfig } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("workspace_id", workspace_id)
        .single();

      if (waConfig && lead?.phone) {
        const provider = waConfig.provider || "meta";
        let waMessageId: string | null = null;

        const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://reconnect.oxineo.com.br/api/evolution";
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

        try {
          if (provider === "evolution" && waConfig.evolution_instance_name) {
            const evoHeaders: Record<string, string> = { "Content-Type": "application/json" };
            if (EVOLUTION_API_KEY) evoHeaders["apikey"] = EVOLUTION_API_KEY;
            const evoResponse = await fetch(
              `${EVOLUTION_API_URL}/message/sendText/${waConfig.evolution_instance_name}`,
              {
                method: "POST",
                headers: evoHeaders,
                body: JSON.stringify({
                  number: lead.phone.replace(/\D/g, ""),
                  text: classification.suggested_response,
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
                  text: { body: classification.suggested_response },
                }),
              }
            );
            const waResult = await waResponse.json();
            if (waResponse.ok && waResult.messages?.[0]?.id) {
              waMessageId = waResult.messages[0].id;
            }
          }

          if (waMessageId) {
            await supabase.from("messages").insert({
              workspace_id,
              lead_id,
              dispatch_id: dispatch_id || null,
              direction: "outbound",
              body: classification.suggested_response,
              whatsapp_message_id: waMessageId,
              status: "sent",
            });
          }
        } catch (sendErr: any) {
          console.error("Auto-respond send error:", sendErr.message);
        }
      }
    }

    return new Response(JSON.stringify({ classification }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Classify response error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
