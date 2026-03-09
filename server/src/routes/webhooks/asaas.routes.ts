import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { config } from "../../config";

const router = Router();

// POST /api/webhooks/asaas — Asaas payment webhook (no auth, verifies token)
router.post("/", async (req: Request, res: Response) => {
  try {
    // 1. Verify webhook token
    const receivedToken = req.headers["asaas-access-token"] as string | undefined;
    if (config.asaasWebhookToken && receivedToken !== config.asaasWebhookToken) {
      console.error("Invalid Asaas webhook token");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body;
    const event = body.event;
    const payment = body.payment;
    const subscription = body.subscription; // present on subscription events

    console.log(`Asaas webhook: ${event}`, JSON.stringify(body).slice(0, 500));

    switch (event) {
      // ── Payment confirmed ──
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        if (!payment) break;

        const subscriptionId = payment.subscription;
        if (!subscriptionId) break;

        // Find local subscription by asaas_subscription_id
        const sub = await prisma.subscription.findFirst({
          where: { asaas_subscription_id: subscriptionId },
          select: { id: true, workspace_id: true, plan: true },
        });

        if (!sub) {
          console.warn(`Subscription not found for asaas id: ${subscriptionId}`);
          break;
        }

        // Update subscription status to active
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "active",
            current_period_start: new Date(),
            current_period_end: periodEnd,
          },
        });

        // Update workspace plan
        await prisma.workspace.update({
          where: { id: sub.workspace_id },
          data: { plan: sub.plan },
        });

        // Record payment
        await prisma.payment.create({
          data: {
            workspace_id: sub.workspace_id,
            subscription_id: sub.id,
            asaas_payment_id: payment.id,
            amount: payment.value || 0,
            status: "confirmed",
            billing_type: payment.billingType || null,
            paid_at: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
            due_date: payment.dueDate ? new Date(payment.dueDate) : null,
            invoice_url: payment.invoiceUrl || null,
          },
        });

        break;
      }

      // ── Payment overdue ──
      case "PAYMENT_OVERDUE": {
        if (!payment?.subscription) break;

        const sub = await prisma.subscription.findFirst({
          where: { asaas_subscription_id: payment.subscription },
          select: { id: true, workspace_id: true },
        });

        if (!sub) break;

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "overdue" },
        });

        // Record overdue payment
        await prisma.payment.create({
          data: {
            workspace_id: sub.workspace_id,
            subscription_id: sub.id,
            asaas_payment_id: payment.id,
            amount: payment.value || 0,
            status: "overdue",
            billing_type: payment.billingType || null,
            due_date: payment.dueDate ? new Date(payment.dueDate) : null,
            invoice_url: payment.invoiceUrl || null,
          },
        });

        break;
      }

      // ── Payment deleted / refunded ──
      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED": {
        if (!payment?.subscription) break;

        const sub = await prisma.subscription.findFirst({
          where: { asaas_subscription_id: payment.subscription },
          select: { id: true, workspace_id: true },
        });

        if (sub) {
          await prisma.payment.create({
            data: {
              workspace_id: sub.workspace_id,
              subscription_id: sub.id,
              asaas_payment_id: payment.id,
              amount: payment.value || 0,
              status: "refunded",
              billing_type: payment.billingType || null,
              due_date: payment.dueDate ? new Date(payment.dueDate) : null,
            },
          });
        }

        break;
      }

      // ── Subscription deleted / canceled ──
      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVE": {
        const subId = subscription || payment?.subscription;
        if (!subId) break;

        const sub = await prisma.subscription.findFirst({
          where: { asaas_subscription_id: subId },
          select: { id: true, workspace_id: true },
        });

        if (!sub) break;

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "canceled" },
        });

        // Downgrade workspace to free plan
        await prisma.workspace.update({
          where: { id: sub.workspace_id },
          data: { plan: "free" },
        });

        break;
      }

      default:
        console.log(`Unhandled Asaas event: ${event}`);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("Asaas webhook error:", err.message);
    // Return 200 to prevent Asaas from retrying
    return res.status(200).json({ error: err.message });
  }
});

export default router;
