import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { emitToWorkspace } from "../../socket";
import { classifyResponse } from "../../services/ai.service";

const router = Router();

const OPT_OUT_KEYWORDS = ["parar", "sair", "cancelar", "remover", "stop", "unsubscribe"];

// GET /api/webhooks/whatsapp — Meta verification challenge
router.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"] as string | undefined;
  const token = req.query["hub.verify_token"] as string | undefined;
  const challenge = req.query["hub.challenge"] as string | undefined;

  if (mode === "subscribe" && token && challenge) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send("Forbidden");
});

// POST /api/webhooks/whatsapp — Meta Cloud API events (no auth)
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      return res.status(200).send("OK");
    }

    // ── Handle status updates (delivered, read, failed) ──
    if (value.statuses) {
      for (const status of value.statuses) {
        const waMessageId = status.id;
        const statusName = status.status; // sent, delivered, read, failed

        if (!waMessageId) continue;

        const updateData: any = {};

        if (statusName === "delivered") {
          updateData.status = "delivered";
          updateData.delivered_at = new Date();
        } else if (statusName === "read") {
          updateData.status = "read";
          updateData.read_at = new Date();
        } else if (statusName === "failed") {
          updateData.status = "failed";
          updateData.error_message = status.errors?.[0]?.title || "Delivery failed";
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.dispatch.updateMany({
            where: { whatsapp_message_id: waMessageId },
            data: updateData,
          });
        }
      }
    }

    // ── Handle incoming messages (replies) ──
    if (value.messages) {
      for (const msg of value.messages) {
        const fromPhone = msg.from; // sender phone in international format
        const msgText = msg.text?.body || "";

        if (!fromPhone) continue;

        // Normalize phone variants
        const phoneVariants = [`+${fromPhone}`, fromPhone];

        // Find the lead by phone
        const lead = await prisma.lead.findFirst({
          where: {
            OR: phoneVariants.map((p) => ({ phone: p })),
          },
          select: { id: true, workspace_id: true, opt_out: true },
        });

        if (!lead) continue;

        // Save inbound message
        await prisma.message.create({
          data: {
            workspace_id: lead.workspace_id,
            lead_id: lead.id,
            direction: "inbound",
            body: msgText,
            whatsapp_message_id: msg.id || null,
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
    }

    return res.status(200).send("OK");
  } catch (err: any) {
    console.error("WhatsApp webhook error:", err.message);
    // Always return 200 to Meta to prevent retries
    return res.status(200).send("OK");
  }
});

export default router;
