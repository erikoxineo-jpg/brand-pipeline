import { prisma } from "../lib/prisma";
import { config } from "../config";
import { emitToWorkspace } from "../socket";
import { sendWhatsAppMessage } from "./whatsapp.service";

/**
 * Handle an inbound WhatsApp message using the autonomous agent.
 * Loads conversation history, builds a multi-turn Claude call,
 * and sends a response (or escalates to human).
 */
export async function handleInboundMessage(params: {
  workspaceId: string;
  leadId: string;
  inboundMessage: string;
  dispatchId?: string;
}): Promise<{ classification?: any; error?: string }> {
  const { workspaceId, leadId, inboundMessage, dispatchId } = params;

  if (!config.anthropicApiKey) {
    console.error("[agent] ANTHROPIC_API_KEY not configured");
    return { error: "ANTHROPIC_API_KEY not configured" };
  }

  try {
    // 1. Load agent config
    const agentConfig = await prisma.agentConfig.findUnique({
      where: { workspace_id: workspaceId },
    });

    if (!agentConfig?.enabled) {
      return { error: "Agent not enabled" };
    }

    // 2. Load lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        name: true,
        phone: true,
        stage: true,
        days_inactive: true,
        opt_out: true,
        agent_escalated: true,
      },
    });

    if (!lead || lead.opt_out) {
      return { error: "Lead not found or opted out" };
    }

    // Don't auto-respond if already escalated to human
    if (lead.agent_escalated) {
      console.log(`[agent] Lead ${leadId} is escalated — skipping agent response`);
      return { error: "Lead escalated to human" };
    }

    // 3. Load last 20 messages (asc) for multi-turn conversation
    const recentMessages = await prisma.message.findMany({
      where: { lead_id: leadId },
      orderBy: { created_at: "asc" },
      take: 20,
      select: { direction: true, body: true, sender_type: true },
    });

    // Convert to Claude messages format
    const claudeMessages: { role: "user" | "assistant"; content: string }[] = recentMessages.map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));

    // Count agent turns (outbound messages with sender_type "agent")
    const agentTurns = recentMessages.filter(
      (m) => m.direction === "outbound" && m.sender_type === "agent"
    ).length;

    // 4. Load campaign context if dispatch exists
    let campaignContext = "";
    if (dispatchId) {
      const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: {
          campaign: {
            select: {
              name: true,
              message_template: true,
              auto_respond_context: true,
            },
          },
        },
      });
      if (dispatch?.campaign) {
        const parts: string[] = [];
        if (dispatch.campaign.message_template) {
          parts.push(`Mensagem inicial da campanha "${dispatch.campaign.name}": ${dispatch.campaign.message_template}`);
        }
        if (dispatch.campaign.auto_respond_context) {
          parts.push(`Contexto adicional: ${dispatch.campaign.auto_respond_context}`);
        }
        campaignContext = parts.join("\n");
      }
    }

    // 5. Build system prompt
    const brandName = agentConfig.brand_name || "a empresa";
    const brandTone = agentConfig.brand_tone || "amigável e informal";
    const businessContext = agentConfig.business_context || "Nenhum contexto de negócio fornecido.";
    const escalationRules = agentConfig.escalation_rules || "Escale quando o cliente pedir para falar com um humano ou quando não souber responder.";

    const systemPrompt = `Você é o assistente virtual da marca ${brandName}.
Seu papel é conversar com clientes inativos que receberam uma mensagem de reativação via WhatsApp.

REGRAS:
1. Responda SEMPRE em português brasileiro, de forma ${brandTone}.
2. Seja breve — mensagens de WhatsApp devem ter no máximo 2-3 frases.
3. NUNCA invente informações sobre produtos, preços ou promoções que não estejam no contexto abaixo.
4. Se o cliente pedir algo que você não sabe, escale para atendimento humano.
5. Se o cliente pedir para parar de receber mensagens, respeite imediatamente.
6. Seu objetivo é reativar o cliente — traga-o de volta.

CONTEXTO DO NEGÓCIO:
${businessContext}

REGRAS DE ESCALAÇÃO:
${escalationRules}

${campaignContext ? `CONTEXTO DA CAMPANHA:\n${campaignContext}` : ""}

DADOS DO LEAD:
- Nome: ${lead.name || "Desconhecido"}
- Dias inativo: ${lead.days_inactive ?? "desconhecido"}

Responda APENAS em JSON válido:
{
  "response": "texto para enviar ao cliente",
  "classification": "positive|negative|question|opt_out|greeting|other",
  "confidence": 0.0-1.0,
  "summary": "resumo curto",
  "new_stage": "replied|reactivated|optout",
  "should_escalate": true|false,
  "escalation_reason": "motivo ou null"
}`;

    // 6. Call Claude Haiku with full multi-turn history
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("[agent] Claude API error:", errText);
      return { error: "Claude API error" };
    }

    const claudeResult: any = await claudeResponse.json();
    const content = claudeResult.content?.[0]?.text || "";

    // 7. Parse JSON response
    let result: {
      response: string;
      classification: string;
      confidence: number;
      summary: string;
      new_stage: string;
      should_escalate: boolean;
      escalation_reason: string | null;
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[agent] Failed to parse Claude response:", content);
      return { error: "Failed to parse agent response" };
    }

    // 8. Check for escalation (explicit or max turns exceeded)
    const shouldEscalate = result.should_escalate || agentTurns >= agentConfig.max_turns;

    if (shouldEscalate) {
      const reason = agentTurns >= agentConfig.max_turns
        ? `Limite de ${agentConfig.max_turns} turnos atingido`
        : result.escalation_reason || "Escalado pelo agente";

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          agent_escalated: true,
          agent_escalated_at: new Date(),
          agent_escalation_reason: reason,
          ai_classification: result.classification,
          ai_summary: result.summary,
        },
      });

      emitToWorkspace(workspaceId, "agent:escalation", {
        leadId,
        leadName: lead.name,
        reason,
      });

      return { classification: { ...result, escalated: true } };
    }

    // 9. Check for opt-out
    if (result.classification === "opt_out" || result.new_stage === "optout") {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          stage: "optout",
          opt_out: true,
          ai_classification: "opt_out",
          ai_summary: result.summary,
        },
      });

      if (dispatchId) {
        await prisma.dispatch.update({
          where: { id: dispatchId },
          data: { next_followup_at: null },
        });
      }

      return { classification: { ...result, opted_out: true } };
    }

    // 10. Send response via WhatsApp
    if (lead.phone && result.response) {
      const sendResult = await sendWhatsAppMessage(
        workspaceId,
        lead.phone,
        result.response,
        dispatchId,
        "agent"
      );

      if (!sendResult.messageId) {
        console.error("[agent] Failed to send response:", sendResult.error);
      }
    }

    // 11. Update dispatch if exists
    if (dispatchId) {
      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
          ai_classification: result.classification,
          ai_confidence: result.confidence,
          ai_summary: result.summary,
          ai_suggested_response: result.response,
          ai_response_status: "auto_sent",
          ai_response_sent: result.response,
        },
      });
    }

    // 12. Update lead
    const leadUpdate: any = {
      ai_classification: result.classification,
      ai_summary: result.summary,
    };

    if (result.new_stage === "reactivated" && result.confidence >= 0.7) {
      leadUpdate.stage = "reactivated";
    } else if (lead.stage === "contacted") {
      leadUpdate.stage = "replied";
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: leadUpdate,
    });

    // 13. Emit socket events
    if (dispatchId) {
      const updatedDispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: {
          lead: { select: { name: true, phone: true } },
          campaign: { select: { name: true } },
        },
      });
      emitToWorkspace(workspaceId, "dispatch:updated", updatedDispatch);
    }

    emitToWorkspace(workspaceId, "message:new", { lead_id: leadId });

    const pendingCount = await prisma.dispatch.count({
      where: { workspace_id: workspaceId, ai_response_status: "pending_review" },
    });
    emitToWorkspace(workspaceId, "ai-pending:count", { count: pendingCount });

    return { classification: result };
  } catch (err: any) {
    console.error("[agent] handleInboundMessage error:", err.message);
    return { error: err.message };
  }
}
