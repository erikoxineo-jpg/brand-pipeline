import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { sendWhatsAppMessage } from "../services/whatsapp.service";
import { emitToWorkspace } from "../socket";

const router = Router();

// GET /api/messages/:leadId
router.get("/:leadId", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const leadId = req.params.leadId as string;

    // Verificar que o lead pertence ao workspace
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspace_id: workspaceId },
      select: { id: true },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrado" });
    }

    const messages = await prisma.message.findMany({
      where: { lead_id: leadId, workspace_id: workspaceId },
      select: {
        id: true,
        direction: true,
        body: true,
        whatsapp_message_id: true,
        status: true,
        created_at: true,
        dispatch_id: true,
        sender_type: true,
      },
      orderBy: { created_at: "asc" },
    });

    res.json(messages);
  } catch (err: any) {
    console.error("List messages error:", err.message);
    res.status(500).json({ error: "Erro ao listar mensagens" });
  }
});

// POST /api/messages/send — Humano envia mensagem a um lead
router.post("/send", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { lead_id, text } = req.body;

    if (!lead_id || !text) {
      return res.status(400).json({ error: "lead_id e text são obrigatórios" });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: lead_id, workspace_id: workspaceId },
      select: { id: true, phone: true, agent_escalated: true },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrado" });
    }

    if (!lead.phone) {
      return res.status(400).json({ error: "Lead sem telefone" });
    }

    // Send via WhatsApp
    const result = await sendWhatsAppMessage(workspaceId, lead.phone, text, undefined, "human");

    if (!result.messageId) {
      return res.status(500).json({ error: result.error || "Erro ao enviar mensagem" });
    }

    // Auto-resolve escalation if lead was escalated
    if (lead.agent_escalated) {
      await prisma.lead.update({
        where: { id: lead_id },
        data: {
          agent_escalated: false,
          agent_escalated_at: null,
          agent_escalation_reason: null,
        },
      });
    }

    // Emit socket events
    emitToWorkspace(workspaceId, "message:new", { lead_id });

    res.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    console.error("Send message error:", err.message);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

export default router;
