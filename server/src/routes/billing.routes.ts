import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { config, planLimits } from "../config";

const router = Router();

const ASAAS_API_URL = "https://api.asaas.com/v3";

interface PlanConfig {
  name: string;
  value: number;
  maxLeads: number;
  maxMessages: number;
  maxUsers: number;
}

const plans: Record<string, PlanConfig> = {
  starter: {
    name: "Starter",
    value: 97,
    maxLeads: 500,
    maxMessages: 1000,
    maxUsers: 1,
  },
  professional: {
    name: "Professional",
    value: 197,
    maxLeads: 2000,
    maxMessages: 5000,
    maxUsers: 3,
  },
  business: {
    name: "Business",
    value: 397,
    maxLeads: 10000,
    maxMessages: 20000,
    maxUsers: 10,
  },
};

// ── Asaas API helper ──
async function asaasFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!config.asaasApiKey) throw new Error("ASAAS_API_KEY is not set");

  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: config.asaasApiKey,
      ...(options.headers || {}),
    },
  });

  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data.errors?.[0]?.description || `Asaas API error: ${res.status}`);
  }
  return data;
}

// ── Find or create Asaas customer ──
async function findOrCreateCustomer(
  email: string,
  name: string,
  cpfCnpj?: string
): Promise<string> {
  const search = await asaasFetch(`/customers?email=${encodeURIComponent(email)}`);
  if (search.data?.length > 0) {
    return search.data[0].id;
  }

  const body: Record<string, unknown> = {
    name: name || email.split("@")[0],
    email,
    notificationDisabled: false,
  };
  if (cpfCnpj) body.cpfCnpj = cpfCnpj;

  const customer = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return customer.id;
}

// POST /api/billing/checkout — Create checkout (Asaas)
router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const workspaceId = req.workspaceId!;

    const { planId, billingType, creditCard, creditCardHolderInfo } = req.body;

    const plan = plans[planId];
    if (!plan) {
      return res
        .status(400)
        .json({ error: `Plano invalido: ${planId}. Validos: starter, professional, business` });
    }

    const validBillingTypes = ["PIX", "BOLETO", "CREDIT_CARD"];
    const effectiveBillingType = validBillingTypes.includes(billingType) ? billingType : "PIX";

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      return res.status(400).json({ error: "Usuario nao encontrado" });
    }

    // Get user display name
    const profile = await prisma.profile.findUnique({
      where: { user_id: userId },
      select: { display_name: true },
    });
    const displayName = profile?.display_name || user.email.split("@")[0];

    // Find or create Asaas customer
    const cpfCnpj = creditCardHolderInfo?.cpfCnpj;
    const asaasCustomerId = await findOrCreateCustomer(user.email, displayName, cpfCnpj);

    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // ─── CREDIT CARD: create subscription with inline card data ───
    if (effectiveBillingType === "CREDIT_CARD") {
      if (!creditCard || !creditCardHolderInfo) {
        return res
          .status(400)
          .json({ error: "Dados do cartao obrigatorios para pagamento com cartao" });
      }

      const nextDueDate = new Date().toISOString().split("T")[0]; // charge today

      const subscription = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: "CREDIT_CARD",
          value: plan.value,
          nextDueDate,
          cycle: "MONTHLY",
          description: `ReConnect CRM - Plano ${plan.name}`,
          externalReference: workspaceId,
          creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number,
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv,
          },
          creditCardHolderInfo: {
            name: creditCardHolderInfo.name,
            cpfCnpj: creditCardHolderInfo.cpfCnpj,
            email: creditCardHolderInfo.email,
            phone: creditCardHolderInfo.phone,
            postalCode: creditCardHolderInfo.postalCode,
            addressNumber: creditCardHolderInfo.addressNumber,
          },
        }),
      });

      // Upsert local subscription
      const existingSub = await prisma.subscription.findFirst({
        where: { workspace_id: workspaceId },
      });

      if (existingSub) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            asaas_customer_id: asaasCustomerId,
            asaas_subscription_id: subscription.id,
            plan: planId,
            status: "active",
            billing_type: "CREDIT_CARD",
            current_period_start: periodStart,
            current_period_end: periodEnd,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            workspace_id: workspaceId,
            asaas_customer_id: asaasCustomerId,
            asaas_subscription_id: subscription.id,
            plan: planId,
            status: "active",
            billing_type: "CREDIT_CARD",
            current_period_start: periodStart,
            current_period_end: periodEnd,
          },
        });
      }

      return res.json({ success: true, subscriptionId: subscription.id });
    }

    // ─── PIX / BOLETO: create single payment, then local subscription ───
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (effectiveBillingType === "BOLETO" ? 3 : 1));
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const payment = await asaasFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: effectiveBillingType,
        value: plan.value,
        dueDate: dueDateStr,
        description: `ReConnect CRM - Plano ${plan.name} (primeira cobranca)`,
        externalReference: workspaceId,
      }),
    });

    // Save subscription locally with pending status (webhook will activate)
    const existingSub = await prisma.subscription.findFirst({
      where: { workspace_id: workspaceId },
    });

    if (existingSub) {
      await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          asaas_customer_id: asaasCustomerId,
          asaas_subscription_id: payment.id, // payment ID until subscription is created
          plan: planId,
          status: "pending",
          billing_type: effectiveBillingType,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          workspace_id: workspaceId,
          asaas_customer_id: asaasCustomerId,
          asaas_subscription_id: payment.id,
          plan: planId,
          status: "pending",
          billing_type: effectiveBillingType,
          current_period_start: periodStart,
          current_period_end: periodEnd,
        },
      });
    }

    if (effectiveBillingType === "PIX") {
      // Fetch PIX QR code
      const pixData = await asaasFetch(`/payments/${payment.id}/pixQrCode`);

      return res.json({
        pixQrCode: pixData.encodedImage,
        pixCode: pixData.payload,
        paymentId: payment.id,
      });
    }

    // BOLETO
    return res.json({
      bankSlipUrl: payment.bankSlipUrl,
      paymentId: payment.id,
    });
  } catch (err: any) {
    console.error("Checkout error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/subscription — Check current subscription
router.get("/subscription", async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;

    // Query local subscriptions table
    const sub = await prisma.subscription.findFirst({
      where: {
        workspace_id: workspaceId,
        status: { in: ["active", "overdue", "trial"] },
      },
      orderBy: { created_at: "desc" },
    });

    if (!sub) {
      return res.json({
        subscribed: false,
        plan: "free",
        status: null,
        limits: planLimits.free,
        currentPeriodEnd: null,
      });
    }

    const limits = planLimits[sub.plan] || planLimits.free;

    return res.json({
      subscribed: sub.status === "active" || sub.status === "trial",
      plan: sub.plan,
      status: sub.status,
      billingType: sub.billing_type,
      limits,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      asaasSubscriptionId: sub.asaas_subscription_id,
    });
  } catch (err: any) {
    console.error("Check subscription error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
