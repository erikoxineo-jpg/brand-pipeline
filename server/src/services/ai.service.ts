import { prisma } from "../lib/prisma";
import { config } from "../config";
import { emitToWorkspace } from "../socket";
import { sendWhatsAppMessage } from "./whatsapp.service";
import { handleInboundMessage } from "./agent.service";

/**
 * Classify an inbound response using Claude API and handle auto-respond logic.
 * If agent is enabled for the workspace, delegates to handleInboundMessage.
 */
export async function classifyResponse(params: {
  leadId: string;
  dispatchId?: string;
  messageBody: string;
  workspaceId: string;
}): Promise<any> {
  const { leadId, dispatchId, messageBody, workspaceId } = params;

  // Delegate to autonomous agent if enabled
  try {
    const agentConfig = await prisma.agentConfig.findUnique({
      where: { workspace_id: workspaceId },
    });

    if (agentConfig?.enabled) {
      return handleInboundMessage({
        workspaceId,
        leadId,
        inboundMessage: messageBody,
        dispatchId,
      });
    }
  } catch (err: any) {
    console.error("[ai] Agent delegation check failed:", err.message);
  }

  if (!config.anthropicApiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return { error: "ANTHROPIC_API_KEY not configured" };
  }

  try {
    // 1. Fetch lead info
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { name: true, phone: true, stage: true },
    });

    // 2. Fetch dispatch + campaign info
    let campaignTemplate = "";
    let autoRespondContext = "";
    let autoRespond = false;
    let autoRespondMode = "review";
    let autoRespondAutoClasses: string[] = [];

    if (dispatchId) {
      const dispatch = await prisma.dispatch.findUnique({
        where: { id: dispatchId },
        include: {
          campaign: {
            select: {
              message_template: true,
              auto_respond: true,
              auto_respond_context: true,
              auto_respond_mode: true,
              auto_respond_auto_classes: true,
            },
          },
        },
      });

      if (dispatch?.campaign) {
        campaignTemplate = dispatch.campaign.message_template || "";
        autoRespond = dispatch.campaign.auto_respond;
        autoRespondContext = dispatch.campaign.auto_respond_context || "";
        autoRespondMode = dispatch.campaign.auto_respond_mode || "review";
        autoRespondAutoClasses = dispatch.campaign.auto_respond_auto_classes || [];
      }
    }

    // 3. Fetch recent messages (last 5)
    const recentMsgs = await prisma.message.findMany({
      where: { lead_id: leadId },
      orderBy: { created_at: "desc" },
      take: 5,
      select: { direction: true, body: true, created_at: true },
    });

    const recentMessages = recentMsgs
      .reverse()
      .map((m) => `[${m.direction === "outbound" ? "Bot" : "Cliente"}] ${m.body}`)
      .join("\n");

    // 4. Call Claude API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Voce e um classificador de respostas de clientes para uma campanha de reativacao via WhatsApp.

Contexto da campanha: ${campaignTemplate}
${autoRespondContext ? `Contexto do negocio: ${autoRespondContext}` : ""}
Nome do cliente: ${lead?.name || "Desconhecido"}
Historico recente:
${recentMessages}

Mensagem recebida: "${messageBody}"

Classifique em JSON:
{
  "classification": "positive|negative|question|opt_out|greeting|other",
  "confidence": 0.0-1.0,
  "summary": "resumo curto em portugues",
  "suggested_response": "resposta sugerida se auto_respond ativo, null se nao aplicavel",
  "should_auto_respond": true|false,
  "new_stage": "replied|reactivated|optout"
}

Regras:
- positive: cliente demonstra interesse, quer saber mais, aceita oferta
- negative: cliente nao tem interesse, recusa educadamente
- question: cliente tem duvida sobre produto/servico/oferta
- opt_out: cliente pede para parar de receber mensagens (parar, sair, cancelar, etc)
- greeting: saudacao simples (oi, ola, bom dia)
- other: nao se encaixa nas categorias acima
- new_stage: "reactivated" se positive com alta confianca, "optout" se opt_out, "replied" nos demais
- should_auto_respond: true para question, greeting, positive; false para negative, other
- Retorne APENAS o JSON, sem nenhum texto antes ou depois`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", errText);
      return { error: "Claude API error" };
    }

    const claudeResult: any = await claudeResponse.json();
    const content = claudeResult.content?.[0]?.text || "";

    // 5. Parse JSON from Claude's response
    let classification: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      classification = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Failed to parse Claude response:", content);
      return { error: "Failed to parse classification" };
    }

    // 6. Update dispatch with AI classification
    if (dispatchId) {
      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
          ai_classification: classification.classification,
          ai_confidence: classification.confidence,
          ai_summary: classification.summary,
        },
      });
    }

    // 7. Update lead with AI classification and stage
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

    await prisma.lead.update({
      where: { id: leadId },
      data: leadUpdate,
    });

    // Nullify follow-ups if opt_out
    if (classification.new_stage === "optout" && dispatchId) {
      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: { next_followup_at: null },
      });
    }

    // 8. Auto-respond logic: review / auto / smart modes
    if (
      classification.should_auto_respond &&
      autoRespond &&
      classification.suggested_response &&
      classification.classification !== "opt_out" &&
      dispatchId
    ) {
      const shouldAutoSend =
        autoRespondMode === "auto" ||
        (autoRespondMode === "smart" &&
          autoRespondAutoClasses.includes(classification.classification));

      if (shouldAutoSend) {
        // Send immediately via whatsapp.service
        if (lead?.phone) {
          const sendResult = await sendWhatsAppMessage(
            workspaceId,
            lead.phone,
            classification.suggested_response,
            dispatchId
          );

          if (sendResult.messageId) {
            // Message saved by sendWhatsAppMessage already
          } else {
            console.error("Auto-respond send error:", sendResult.error);
          }
        }

        // Mark as auto_sent
        await prisma.dispatch.update({
          where: { id: dispatchId },
          data: {
            ai_suggested_response: classification.suggested_response,
            ai_response_status: "auto_sent",
            ai_response_sent: classification.suggested_response,
          },
        });
      } else {
        // Queue for human review (review mode, or smart mode without class match)
        await prisma.dispatch.update({
          where: { id: dispatchId },
          data: {
            ai_suggested_response: classification.suggested_response,
            ai_response_status: "pending_review",
          },
        });
      }
    }

    // 9. Emit socket events
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

    // 10. Emit updated AI pending count
    const pendingCount = await prisma.dispatch.count({
      where: {
        workspace_id: workspaceId,
        ai_response_status: "pending_review",
      },
    });
    emitToWorkspace(workspaceId, "ai-pending:count", { count: pendingCount });

    return { classification };
  } catch (err: any) {
    console.error("classifyResponse error:", err.message);
    return { error: err.message };
  }
}
