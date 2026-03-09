import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      leadCount,
      campaignCount,
      dispatchCount,
      leadStagesRaw,
      dispatchStatusesRaw,
      weeklyDispatches,
      activeCampaigns,
      classifiedLast24h,
      autoRespondedLast24h,
    ] = await Promise.all([
      // Total de leads do workspace
      prisma.lead.count({
        where: { workspace_id: workspaceId },
      }),

      // Total de campaigns do workspace
      prisma.campaign.count({
        where: { workspace_id: workspaceId },
      }),

      // Total de dispatches com status != "pending"
      prisma.dispatch.count({
        where: { workspace_id: workspaceId, status: { not: "pending" } },
      }),

      // Leads agrupados por stage
      prisma.lead.groupBy({
        by: ["stage"],
        where: { workspace_id: workspaceId },
        _count: { id: true },
      }),

      // Dispatches agrupados por status
      prisma.dispatch.groupBy({
        by: ["status"],
        where: { workspace_id: workspaceId },
        _count: { id: true },
      }),

      // Dispatches dos últimos 7 dias
      prisma.dispatch.findMany({
        where: {
          workspace_id: workspaceId,
          created_at: { gte: sevenDaysAgo },
        },
        select: {
          id: true,
          status: true,
          sent_at: true,
        },
        orderBy: { created_at: "desc" },
      }),

      // Campaigns ativas com auto_dispatch
      prisma.campaign.count({
        where: {
          workspace_id: workspaceId,
          auto_dispatch: true,
          status: "active",
        },
      }),

      // Dispatches classificados por AI nas últimas 24h
      prisma.dispatch.count({
        where: {
          workspace_id: workspaceId,
          ai_classification: { not: null },
          created_at: { gte: twentyFourHoursAgo },
        },
      }),

      // Dispatches com auto-resposta nas últimas 24h
      prisma.dispatch.count({
        where: {
          workspace_id: workspaceId,
          ai_response_status: "auto_sent",
          created_at: { gte: twentyFourHoursAgo },
        },
      }),
    ]);

    // Formatar leadStages: [{ stage, count }]
    const leadStages = leadStagesRaw.map((row) => ({
      stage: row.stage,
      count: row._count.id,
    }));

    // Formatar dispatchStatuses: [{ status, count }]
    const dispatchStatuses = dispatchStatusesRaw.map((row) => ({
      status: row.status,
      count: row._count.id,
    }));

    res.json({
      stats: {
        leadCount,
        campaignCount,
        dispatchCount,
        leadStages,
        dispatchStatuses,
        weeklyDispatches,
        activeCampaigns,
        aiStats: {
          classifiedLast24h,
          autoRespondedLast24h,
        },
      },
    });
  } catch (err: any) {
    console.error("Dashboard stats error:", err.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas do dashboard" });
  }
});

export default router;
