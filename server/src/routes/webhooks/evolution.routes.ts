import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { emitToWorkspace } from "../../socket";
import { classifyResponse } from "../../services/ai.service";

const router = Router();

const OPT_OUT_KEYWORDS = ["parar", "sair", "cancelar", "remover", "stop", "unsubscribe"];

// POST /api/webhooks/evolution/* — Evolution API webhook (no auth)
// Evolution v2 with WEBHOOK_BY_EVENTS appends event name as path: /messages-upsert, /connection-update, etc.
router.post("*", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const event = body.event;

    // ── Handle connection status updates ──
    if (event === "connection.update") {
      const instanceName = body.instance;
      const state = body.data?.state; // open, close, connecting

      if (instanceName && state) {
        const evoStatus =
          state === "open" ? "connected" : state === "close" ? "disconnected" : "connecting";

        await prisma.whatsappConfig.updateMany({
          where: { evolution_instance_name: instanceName },
          data: { evolution_status: evoStatus },
        });
      }

      return res.status(200).send("OK");
    }

    // ── Handle incoming messages ──
    if (event === "messages.upsert") {
      const data = body.data;
      if (!data) return res.status(200).send("OK");

      const key = data.key;
      if (!key || key.fromMe) return res.status(200).send("OK");

      // Extract phone from remoteJid (format: 5511999999999@s.whatsapp.net)
      const remoteJid = key.remoteJid || "";
      const fromPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      if (!fromPhone) return res.status(200).send("OK");

      const msgText =
        data.message?.conversation ||
        data.message?.extendedTextMessage?.text ||
        "";

      const messageId = key.id || null;

      // Normalize phone variants
      const phoneVariants = [`+${fromPhone}`, fromPhone];

      // Find the lead by phone
      const lead = await prisma.lead.findFirst({
        where: {
          OR: phoneVariants.map((p) => ({ phone: p })),
        },
        select: { id: true, workspace_id: true, opt_out: true },
      });

      if (!lead) return res.status(200).send("OK");

      // Save inbound message
      await prisma.message.create({
        data: {
          workspace_id: lead.workspace_id,
          lead_id: lead.id,
          direction: "inbound",
          body: msgText,
          whatsapp_message_id: messageId,
          status: "received",
        },
      });

      // Check opt-out
      const isOptOut = OPT_OUT_KEYWORDS.some((kw) =>
        msgText.toLowerCase().includes(kw)
      );

      if (isOptOut) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { opt_out: true, stage: "optout" },
        });
      } else {
        // Only update stage if currently in contacted or ready
        const currentLead = await prisma.lead.findUnique({
          where: { id: lead.id },
          select: { stage: true },
        });
        if (currentLead && ["contacted", "ready"].includes(currentLead.stage)) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { stage: "replied" },
          });
        }
      }

      // Find the most recent dispatch for this lead and mark as replied
      const dispatch = await prisma.dispatch.findFirst({
        where: {
          lead_id: lead.id,
          status: { in: ["sent", "delivered", "read"] },
        },
        orderBy: { sent_at: "desc" },
        select: { id: true },
      });

      if (dispatch) {
        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: {
            status: "replied",
            replied_at: new Date(),
            next_followup_at: null,
          },
        });
      }

      // Emit socket event for new message
      emitToWorkspace(lead.workspace_id, "message:new", {
        lead_id: lead.id,
        direction: "inbound",
        body: msgText,
      });

      // Classify response with AI (fire-and-forget)
      if (!isOptOut && !lead.opt_out && msgText.trim()) {
        classifyResponse({
          leadId: lead.id,
          dispatchId: dispatch?.id,
          messageBody: msgText,
          workspaceId: lead.workspace_id,
        }).catch((err) => console.error("classifyResponse error:", err.message));
      }
    }

    return res.status(200).send("OK");
  } catch (err: any) {
    console.error("Evolution webhook error:", err.message);
    // Always return 200 to prevent retries
    return res.status(200).send("OK");
  }
});

export default router;
