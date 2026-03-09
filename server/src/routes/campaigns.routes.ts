import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/campaigns
router.get("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const campaigns = await prisma.campaign.findMany({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
    });

    res.json(campaigns);
  } catch (err: any) {
    console.error("List campaigns error:", err.message);
    res.status(500).json({ error: "Erro ao listar campanhas" });
  }
});

// GET /api/campaigns/stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const dispatches = await prisma.dispatch.groupBy({
      by: ["campaign_id", "status"],
      where: { workspace_id: workspaceId, campaign_id: { not: null } },
      _count: { id: true },
    });

    const stats: Record<string, { total: number; sent: number; replied: number }> = {};

    for (const row of dispatches) {
      const campaignId = row.campaign_id!;
      if (!stats[campaignId]) {
        stats[campaignId] = { total: 0, sent: 0, replied: 0 };
      }

      stats[campaignId].total += row._count.id;

      if (row.status === "sent" || row.status === "delivered" || row.status === "read" || row.status === "replied") {
        stats[campaignId].sent += row._count.id;
      }

      if (row.status === "replied") {
        stats[campaignId].replied += row._count.id;
      }
    }

    res.json(stats);
  } catch (err: any) {
    console.error("Campaign stats error:", err.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

// POST /api/campaigns
router.post("/", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name é obrigatório" });
    }

    const campaign = await prisma.campaign.create({
      data: {
        workspace_id: workspaceId,
        name,
        status: "draft",
      },
    });

    res.status(201).json({ campaign });
  } catch (err: any) {
    console.error("Create campaign error:", err.message);
    res.status(500).json({ error: "Erro ao criar campanha" });
  }
});

// PATCH /api/campaigns/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const id = req.params.id as string;

    // Verificar que a campanha pertence ao workspace
    const existing = await prisma.campaign.findFirst({
      where: { id, workspace_id: workspaceId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Campanha não encontrada" });
    }

    const {
      status,
      message_template,
      survey_questions,
      offer_type,
      offer_value,
      offer_rule,
      target_stages,
      followup_enabled,
      followup_messages,
      followup_interval_days,
      auto_dispatch,
      auto_respond,
      auto_respond_context,
      auto_respond_mode,
      auto_respond_auto_classes,
      max_daily_dispatches,
      name,
    } = req.body;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(name !== undefined && { name }),
        ...(message_template !== undefined && { message_template }),
        ...(survey_questions !== undefined && { survey_questions }),
        ...(offer_type !== undefined && { offer_type }),
        ...(offer_value !== undefined && { offer_value }),
        ...(offer_rule !== undefined && { offer_rule }),
        ...(target_stages !== undefined && { target_stages }),
        ...(followup_enabled !== undefined && { followup_enabled }),
        ...(followup_messages !== undefined && { followup_messages }),
        ...(followup_interval_days !== undefined && { followup_interval_days }),
        ...(auto_dispatch !== undefined && { auto_dispatch }),
        ...(auto_respond !== undefined && { auto_respond }),
        ...(auto_respond_context !== undefined && { auto_respond_context }),
        ...(auto_respond_mode !== undefined && { auto_respond_mode }),
        ...(auto_respond_auto_classes !== undefined && { auto_respond_auto_classes }),
        ...(max_daily_dispatches !== undefined && { max_daily_dispatches }),
      },
    });

    res.json({ campaign });
  } catch (err: any) {
    console.error("Update campaign error:", err.message);
    res.status(500).json({ error: "Erro ao atualizar campanha" });
  }
});

// DELETE /api/campaigns/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const id = req.params.id as string;

    // Verificar que a campanha pertence ao workspace
    const existing = await prisma.campaign.findFirst({
      where: { id, workspace_id: workspaceId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Campanha não encontrada" });
    }

    await prisma.campaign.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete campaign error:", err.message);
    res.status(500).json({ error: "Erro ao deletar campanha" });
  }
});

export default router;
