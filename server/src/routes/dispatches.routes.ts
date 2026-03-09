import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /api/dispatches?status=&campaign=&search=
router.get("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const status = req.query.status as string | undefined;
    const campaignId = req.query.campaign as string | undefined;
    const search = (req.query.search as string) || "";

    const where: Prisma.DispatchWhereInput = { workspace_id: workspaceId };

    if (status) {
      where.status = status;
    }

    if (campaignId) {
      where.campaign_id = campaignId;
    }

    if (search) {
      where.lead = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const dispatches = await prisma.dispatch.findMany({
      where,
      include: {
        lead: { select: { name: true, phone: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    res.json(dispatches);
  } catch (err: any) {
    console.error("List dispatches error:", err.message);
    res.status(500).json({ error: "Erro ao listar envios" });
  }
});

// GET /api/dispatches/pending-reviews
router.get("/pending-reviews", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const dispatches = await prisma.dispatch.findMany({
      where: {
        workspace_id: workspaceId,
        ai_response_status: "pending_review",
      },
      include: {
        lead: { select: { name: true, phone: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
    });

    res.json(dispatches);
  } catch (err: any) {
    console.error("Pending reviews error:", err.message);
    res.status(500).json({ error: "Erro ao listar revisões pendentes" });
  }
});

// POST /api/dispatches
router.post("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { lead_ids, campaign_id } = req.body;

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: "lead_ids é obrigatório e deve ser um array não vazio" });
    }

    if (!campaign_id) {
      return res.status(400).json({ error: "campaign_id é obrigatório" });
    }

    // Verificar que a campanha pertence ao workspace
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaign_id, workspace_id: workspaceId },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campanha não encontrada" });
    }

    // Verificar que os leads pertencem ao workspace
    const validLeads = await prisma.lead.findMany({
      where: { id: { in: lead_ids }, workspace_id: workspaceId },
      select: { id: true },
    });

    const validIds = validLeads.map((l) => l.id);

    if (validIds.length === 0) {
      return res.status(400).json({ error: "Nenhum lead válido encontrado" });
    }

    // Criar dispatches em batch
    const result = await prisma.dispatch.createMany({
      data: validIds.map((leadId) => ({
        workspace_id: workspaceId,
        lead_id: leadId,
        campaign_id,
        status: "pending",
      })),
    });

    res.status(201).json({ count: result.count });
  } catch (err: any) {
    console.error("Create dispatches error:", err.message);
    res.status(500).json({ error: "Erro ao criar envios" });
  }
});

// POST /api/dispatches/send
router.post("/send", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { dispatch_ids } = req.body;

    if (!Array.isArray(dispatch_ids) || dispatch_ids.length === 0) {
      return res.status(400).json({ error: "dispatch_ids é obrigatório e deve ser um array não vazio" });
    }

    // Placeholder: marcar como "sent" (lógica real de WhatsApp será em whatsapp.service.ts)
    const result = await prisma.dispatch.updateMany({
      where: {
        id: { in: dispatch_ids },
        workspace_id: workspaceId,
        status: "pending",
      },
      data: {
        status: "sent",
        sent_at: new Date(),
      },
    });

    res.json({ results: { updated: result.count } });
  } catch (err: any) {
    console.error("Send dispatches error:", err.message);
    res.status(500).json({ error: "Erro ao enviar mensagens" });
  }
});

// POST /api/dispatches/review
router.post("/review", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { dispatch_id, action, response_text } = req.body;

    if (!dispatch_id) {
      return res.status(400).json({ error: "dispatch_id é obrigatório" });
    }

    if (!["approve", "edit", "reject"].includes(action)) {
      return res.status(400).json({ error: "action deve ser 'approve', 'edit' ou 'reject'" });
    }

    // Verificar que o dispatch pertence ao workspace
    const existing = await prisma.dispatch.findFirst({
      where: { id: dispatch_id, workspace_id: workspaceId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Envio não encontrado" });
    }

    const statusMap: Record<string, string> = {
      approve: "approved",
      edit: "edited",
      reject: "rejected",
    };

    await prisma.dispatch.update({
      where: { id: dispatch_id },
      data: {
        ai_response_status: statusMap[action],
        ai_reviewed_at: new Date(),
        ai_reviewed_by: userId,
        ...(response_text !== undefined && { ai_suggested_response: response_text }),
      },
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Review dispatch error:", err.message);
    res.status(500).json({ error: "Erro ao revisar resposta" });
  }
});

export default router;
