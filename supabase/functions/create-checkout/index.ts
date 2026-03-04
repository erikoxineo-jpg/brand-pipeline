import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://reconnect.oxineo.com.br",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan configuration: setup (one-time) + monthly subscription
const plans: Record<string, { setupPriceId: string; monthlyPriceId: string }> = {
  "1000": {
    setupPriceId: "price_1T6yXOAUQ74jIH1kL1YWrrp5",
    monthlyPriceId: "price_1T6yZWAUQ74jIH1k4I3zrR1Q",
  },
  "5000": {
    setupPriceId: "price_1T6yXlAUQ74jIH1keHF19TiX",
    monthlyPriceId: "price_1T6yZrAUQ74jIH1kpYMiCbBI",
  },
  "10000": {
    setupPriceId: "price_1T6yY8AUQ74jIH1kooEle5J6",
    monthlyPriceId: "price_1T6ya2AUQ74jIH1kYyXEBkgt",
  },
  "25000": {
    setupPriceId: "price_1T6yZ7AUQ74jIH1kcIGzW9s1",
    monthlyPriceId: "price_1T6yaHAUQ74jIH1kuWxyoC7H",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { planId } = await req.json();
    const plan = plans[planId];
    if (!plan) throw new Error(`Invalid plan: ${planId}`);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or reference existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://reconnect.oxineo.com.br";

    // Create checkout with setup fee + subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        { price: plan.setupPriceId, quantity: 1 },
        { price: plan.monthlyPriceId, quantity: 1 },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/#pricing`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
