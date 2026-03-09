import { prisma } from "../lib/prisma";
import { config } from "../config";
import { sendWhatsAppMessage } from "./whatsapp.service";
import { emitToWorkspace } from "../socket";

export async function runCampaignEngine() {
  const results = { dispatches_created: 0, messages_sent: 0, followups_sent: 0, errors: [] as string[] };

  try {
    // ========================================
    // STEP 1: Auto-create dispatches
    // ========================================
    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: "active", auto_dispatch: true },
    });

    for (const campaign of activeCampaigns) {
      try {
        const targetStages = campaign.target_stages.length > 0 ? campaign.target_stages : ["eligible", "ready"];
        const maxDaily = campaign.max_daily_dispatches || 100;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayCount = await prisma.dispatch.count({
          where: { campaign_id: campaign.id, created_at: { gte: todayStart } },
        });

        const remaining = maxDaily - todayCount;
        if (remaining <= 0) continue;

        const existingDispatches = await prisma.dispatch.findMany({
          where: { campaign_id: campaign.id },
          select: { lead_id: true },
        });
        const existingLeadIds = new Set(existingDispatches.map((d) => d.lead_id));

        const eligibleLeads = await prisma.lead.findMany({
          where: {
            workspace_id: campaign.workspace_id,
            opt_out: false,
            stage: { in: targetStages },
          },
          select: { id: true },
          take: remaining,
        });

        const newLeads = eligibleLeads.filter((l) => !existingLeadIds.has(l.id));

        if (newLeads.length > 0) {
          await prisma.dispatch.createMany({
            data: newLeads.map((l) => ({
              workspace_id: campaign.workspace_id,
              lead_id: l.id,
              campaign_id: campaign.id,
              status: "pending",
            })),
          });
          results.dispatches_created += newLeads.length;
        }
      } catch (err: any) {
        results.errors.push(`Campaign ${campaign.id}: ${err.message}`);
      }
    }

    // ========================================
    // STEP 2: Auto-send pending dispatches
    // ========================================
    const activeCampaignIds = activeCampaigns.map((c) => c.id);

    const pendingDispatches = await prisma.dispatch.findMany({
      where: {
        status: "pending",
        campaign_id: { in: activeCampaignIds },
      },
      include: {
        lead: { select: { name: true, phone: true, days_inactive: true, stage: true } },
        campaign: { select: { message_template: true, followup_enabled: true, followup_messages: true, workspace_id: true } },
      },
      orderBy: { created_at: "asc" },
      take: 50,
    });

    const wsNameCache: Record<string, string> = {};

    for (let i = 0; i < pendingDispatches.length; i++) {
      const dispatch = pendingDispatches[i];
      const lead = dispatch.lead;
      const campaign = dispatch.campaign;

      if (!lead?.phone) {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { status: "failed", error_message: "Sem número de telefone" },
        });
        continue;
      }

      try {
        if (!wsNameCache[dispatch.workspace_id]) {
          const ws = await prisma.workspace.findUnique({
            where: { id: dispatch.workspace_id },
            select: { name: true },
          });
          wsNameCache[dispatch.workspace_id] = ws?.name || "nossa marca";
        }
        const brandName = wsNameCache[dispatch.workspace_id];

        let message = campaign?.message_template || "Olá, sentimos sua falta!";
        message = message.replace(/\{\{nome\}\}/g, lead.name || "");
        message = message.replace(/\{\{dias\}\}/g, String(lead.days_inactive || ""));
        message = message.replace(/\{\{marca\}\}/g, brandName);

        const result = await sendWhatsAppMessage(dispatch.workspace_id, lead.phone, message, dispatch.id);

        if (result.messageId) {
          await prisma.dispatch.update({
            where: { id: dispatch.id },
            data: {
              status: "sent",
              sent_at: new Date(),
              whatsapp_message_id: result.messageId,
            },
          });

          // Schedule follow-up if enabled
          const followupMessages = (campaign?.followup_messages as any[]) || [];
          if (campaign?.followup_enabled && followupMessages.length > 0) {
            const nextFollowup = followupMessages[0];
            const delayDays = nextFollowup?.delay_days || 3;
            await prisma.dispatch.update({
              where: { id: dispatch.id },
              data: {
                next_followup_at: new Date(Date.now() + delayDays * 86400000),
                followup_index: 0,
              },
            });
          }

          // Update lead stage to contacted
          if (["ready", "imported", "eligible"].includes(lead.stage)) {
            await prisma.lead.update({
              where: { id: dispatch.lead_id },
              data: { stage: "contacted" },
            });
          }

          emitToWorkspace(dispatch.workspace_id, "dispatch:updated", { id: dispatch.id, status: "sent" });
          results.messages_sent++;
        } else {
          await prisma.dispatch.update({
            where: { id: dispatch.id },
            data: { status: "failed", error_message: result.error || "Erro desconhecido" },
          });
        }
      } catch (sendErr: any) {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { status: "failed", error_message: sendErr.message },
        });
        results.errors.push(`Send ${dispatch.id}: ${sendErr.message}`);
      }

      // Rate limit delay
      if (i < pendingDispatches.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    // ========================================
    // STEP 3: Process follow-ups
    // ========================================
    const followupDispatches = await prisma.dispatch.findMany({
      where: {
        next_followup_at: { lte: new Date() },
        status: { in: ["sent", "delivered", "read"] },
      },
      include: {
        lead: { select: { name: true, phone: true, days_inactive: true, opt_out: true } },
        campaign: { select: { followup_enabled: true, followup_messages: true } },
      },
      take: 50,
    });

    for (const dispatch of followupDispatches) {
      const lead = dispatch.lead;
      const campaign = dispatch.campaign;

      if (!lead?.phone || lead.opt_out || !campaign?.followup_enabled) {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { next_followup_at: null },
        });
        continue;
      }

      const followupMessages = (campaign.followup_messages as any[]) || [];
      const currentIndex = dispatch.followup_index || 0;

      if (currentIndex >= followupMessages.length) {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { next_followup_at: null },
        });
        continue;
      }

      const followup = followupMessages[currentIndex];
      let message = followup?.template || "Olá, tudo bem?";

      if (!wsNameCache[dispatch.workspace_id]) {
        const ws = await prisma.workspace.findUnique({
          where: { id: dispatch.workspace_id },
          select: { name: true },
        });
        wsNameCache[dispatch.workspace_id] = ws?.name || "nossa marca";
      }

      message = message.replace(/\{\{nome\}\}/g, lead.name || "");
      message = message.replace(/\{\{dias\}\}/g, String(lead.days_inactive || ""));
      message = message.replace(/\{\{marca\}\}/g, wsNameCache[dispatch.workspace_id]);

      const result = await sendWhatsAppMessage(dispatch.workspace_id, lead.phone, message, dispatch.id);

      if (result.messageId) {
        const nextIndex = currentIndex + 1;
        const hasMore = nextIndex < followupMessages.length;

        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: {
            followup_index: nextIndex,
            next_followup_at: hasMore
              ? new Date(Date.now() + (followupMessages[nextIndex]?.delay_days || 3) * 86400000)
              : null,
          },
        });

        results.followups_sent++;
      } else {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { next_followup_at: null },
        });
      }

      await new Promise((r) => setTimeout(r, 3000));
    }

    console.log("Campaign engine:", JSON.stringify(results));
  } catch (err: any) {
    console.error("Campaign engine error:", err.message);
  }

  return results;
}
