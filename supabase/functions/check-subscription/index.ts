import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://reconnect.oxineo.com.br",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const planLimits: Record<string, { maxLeads: number; maxMessages: number; maxUsers: number }> = {
  starter: { maxLeads: 500, maxMessages: 1000, maxUsers: 1 },
  professional: { maxLeads: 2000, maxMessages: 5000, maxUsers: 3 },
  business: { maxLeads: 10000, maxMessages: 20000, maxUsers: 10 },
  free: { maxLeads: 50, maxMessages: 100, maxUsers: 1 },
};

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Get user's workspace
    const { data: membership } = await supabaseClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({
        subscribed: false,
        plan: "free",
        status: null,
        limits: planLimits.free,
        currentPeriodEnd: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query local subscriptions table
    const { data: sub } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("workspace_id", membership.workspace_id)
      .in("status", ["active", "overdue", "trial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!sub) {
      return new Response(JSON.stringify({
        subscribed: false,
        plan: "free",
        status: null,
        limits: planLimits.free,
        currentPeriodEnd: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limits = planLimits[sub.plan] || planLimits.free;

    return new Response(JSON.stringify({
      subscribed: sub.status === "active" || sub.status === "trial",
      plan: sub.plan,
      status: sub.status,
      billingType: sub.billing_type,
      limits,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      asaasSubscriptionId: sub.asaas_subscription_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
