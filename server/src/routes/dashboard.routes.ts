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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      leadCount,
      campaignCount,
      dispatchCount,
      dispatchesToday,
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

      // Dispatches enviados hoje
      prisma.dispatch.count({
        where: {
          workspace_id: workspaceId,
          status: { not: "pending" },
          sent_at: { gte: todayStart },
        },
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

    // Formatar leadStages: Record<string, number> (ex: { eligible: 5, contacted: 3 })
    const leadStages: Record<string, number> = {};
    for (const row of leadStagesRaw) {
      leadStages[row.stage] = row._count.id;
    }

    // Formatar dispatchStatuses: Record<string, number> (ex: { sent: 2, replied: 3 })
    const dispatchStatuses: Record<string, number> = {};
    for (const row of dispatchStatusesRaw) {
      dispatchStatuses[row.status] = row._count.id;
    }

    // Agrupar weeklyDispatches por dia: { day, disparos, respostas }[]
    const dayMap: Record<string, { disparos: number; respostas: number }> = {};
    for (const d of weeklyDispatches) {
      const day = (d.sent_at || new Date()).toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { disparos: 0, respostas: 0 };
      dayMap[day].disparos++;
      if (d.status === "replied") dayMap[day].respostas++;
    }
    const weeklyData = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, ...v }));

    res.json({
      leadCount,
      campaignCount,
      dispatchCount,
      dispatchesToday,
      leadStages,
      dispatchStatuses,
      weeklyDispatches: weeklyData,
      activeCampaigns,
      aiStats: {
        activeCampaigns,
        sent24h: dispatchStatuses.sent || 0,
        classified24h: classifiedLast24h,
        autoResponded24h: autoRespondedLast24h,
      },
    });
  } catch (err: any) {
    console.error("Dashboard stats error:", err.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas do dashboard" });
  }
});

export default router;
