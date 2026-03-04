import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://reconnect.oxineo.com.br",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

interface PlanConfig {
  name: string;
  value: number; // cents → R$
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

async function asaasFetch(path: string, options: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY is not set");

  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.errors?.[0]?.description || `Asaas API error: ${res.status}`);
  }
  return data;
}

async function findOrCreateCustomer(email: string, name: string): Promise<string> {
  // Search existing customer by email
  const search = await asaasFetch(`/customers?email=${encodeURIComponent(email)}`);
  if (search.data?.length > 0) {
    return search.data[0].id;
  }

  // Create new customer
  const customer = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: name || email.split("@")[0],
      email,
      notificationDisabled: false,
    }),
  });

  return customer.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { planId, billingType } = await req.json();
    const plan = plans[planId];
    if (!plan) throw new Error(`Invalid plan: ${planId}. Valid: starter, professional, business`);

    const validBillingTypes = ["PIX", "BOLETO", "CREDIT_CARD"];
    const effectiveBillingType = validBillingTypes.includes(billingType) ? billingType : "PIX";

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Get user's workspace
    const { data: membership } = await supabaseClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) throw new Error("No workspace found for user");
    const workspaceId = membership.workspace_id;

    // Get user display name
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const displayName = profile?.display_name || user.email.split("@")[0];

    // Find or create Asaas customer
    const asaasCustomerId = await findOrCreateCustomer(user.email, displayName);

    // Create subscription in Asaas
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); // First charge tomorrow
    const dueDateStr = nextDueDate.toISOString().split("T")[0];

    const subscription = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: effectiveBillingType,
        value: plan.value,
        nextDueDate: dueDateStr,
        cycle: "MONTHLY",
        description: `ReConnect CRM - Plano ${plan.name}`,
        externalReference: workspaceId,
      }),
    });

    // Save subscription locally
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabaseClient.from("subscriptions").upsert(
      {
        workspace_id: workspaceId,
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: subscription.id,
        plan: planId,
        status: "active",
        billing_type: effectiveBillingType,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      },
      { onConflict: "workspace_id" }
    );

    // Build payment link URL
    // Asaas returns invoiceUrl on the first payment of the subscription
    const paymentUrl = subscription.paymentLink
      || `https://www.asaas.com/c/${subscription.id}`;

    return new Response(JSON.stringify({ url: paymentUrl, subscriptionId: subscription.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("create-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
