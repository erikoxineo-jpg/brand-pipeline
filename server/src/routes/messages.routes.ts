import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

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
      },
      orderBy: { created_at: "asc" },
    });

    res.json(messages);
  } catch (err: any) {
    console.error("List messages error:", err.message);
    res.status(500).json({ error: "Erro ao listar mensagens" });
  }
});

export default router;
