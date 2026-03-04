import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const planFromValue: Record<number, string> = {
  97: "starter",
  197: "professional",
  397: "business",
};

serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validate webhook access token
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (webhookToken && receivedToken !== webhookToken) {
    console.error("Invalid webhook token");
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
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
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, workspace_id, plan")
          .eq("asaas_subscription_id", subscriptionId)
          .single();

        if (!sub) {
          console.warn(`Subscription not found for asaas id: ${subscriptionId}`);
          break;
        }

        // Update subscription status to active
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .eq("id", sub.id);

        // Update workspace plan
        await supabase
          .from("workspaces")
          .update({ plan: sub.plan })
          .eq("id", sub.workspace_id);

        // Record payment
        await supabase.from("payments").insert({
          workspace_id: sub.workspace_id,
          subscription_id: sub.id,
          asaas_payment_id: payment.id,
          amount: payment.value || 0,
          status: "confirmed",
          billing_type: payment.billingType || null,
          paid_at: payment.paymentDate || new Date().toISOString(),
          due_date: payment.dueDate || null,
          invoice_url: payment.invoiceUrl || null,
        });

        break;
      }

      // ── Payment overdue ──
      case "PAYMENT_OVERDUE": {
        if (!payment?.subscription) break;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, workspace_id")
          .eq("asaas_subscription_id", payment.subscription)
          .single();

        if (!sub) break;

        await supabase
          .from("subscriptions")
          .update({ status: "overdue" })
          .eq("id", sub.id);

        // Record overdue payment
        await supabase.from("payments").insert({
          workspace_id: sub.workspace_id,
          subscription_id: sub.id,
          asaas_payment_id: payment.id,
          amount: payment.value || 0,
          status: "overdue",
          billing_type: payment.billingType || null,
          due_date: payment.dueDate || null,
          invoice_url: payment.invoiceUrl || null,
        });

        break;
      }

      // ── Payment deleted / refunded ──
      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED": {
        if (!payment?.subscription) break;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, workspace_id")
          .eq("asaas_subscription_id", payment.subscription)
          .single();

        if (sub) {
          await supabase.from("payments").insert({
            workspace_id: sub.workspace_id,
            subscription_id: sub.id,
            asaas_payment_id: payment.id,
            amount: payment.value || 0,
            status: "refunded",
            billing_type: payment.billingType || null,
            due_date: payment.dueDate || null,
          });
        }

        break;
      }

      // ── Subscription deleted / canceled ──
      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVE": {
        const subId = subscription || payment?.subscription;
        if (!subId) break;

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, workspace_id")
          .eq("asaas_subscription_id", subId)
          .single();

        if (!sub) break;

        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("id", sub.id);

        // Downgrade workspace to free plan
        await supabase
          .from("workspaces")
          .update({ plan: "free" })
          .eq("id", sub.workspace_id);

        break;
      }

      default:
        console.log(`Unhandled Asaas event: ${event}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Asaas webhook error:", msg);
    // Return 200 to prevent Asaas from retrying
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }
});
