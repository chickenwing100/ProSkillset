import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@16.10.0"
import { corsHeaders } from "../_shared/cors.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("stripe_secret_key") || "", {
  apiVersion: "2024-06-20"
})

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

const priceIdByPlan = {
  solo: Deno.env.get("STRIPE_SOLO_PRICE_ID") || "",
  crew: Deno.env.get("STRIPE_CREW_PRICE_ID") || "",
  builder: Deno.env.get("STRIPE_BUILDER_PRICE_ID") || ""
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = request.headers.get("Authorization") || ""
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    if (!accessToken) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }

    const {
      data: { user },
      error: userError
    } = await serviceClient.auth.getUser(accessToken)

    if (userError || !user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders })
    }

    const body = await request.json()
    const planId = String(body?.planId || "")
    const successUrl = String(body?.successUrl || "")
    const cancelUrl = String(body?.cancelUrl || "")
    const priceId = priceIdByPlan[planId as keyof typeof priceIdByPlan]

    if (!priceId) {
      return Response.json({ error: "Stripe price ID is not configured for this plan" }, { status: 400, headers: corsHeaders })
    }

    if (!successUrl || !cancelUrl) {
      return Response.json({ error: "Missing success or cancel URL" }, { status: 400, headers: corsHeaders })
    }

    const normalizedEmail = user.email.trim().toLowerCase()

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("email, full_name, business_name, stripe_customer_id")
      .eq("email", normalizedEmail)
      .maybeSingle()

    let stripeCustomerId = profile?.stripe_customer_id || ""
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        name: profile?.business_name || profile?.full_name || normalizedEmail,
        metadata: {
          email: normalizedEmail,
          supabase_user_id: user.id
        }
      })
      stripeCustomerId = customer.id

      await serviceClient
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
        .eq("email", normalizedEmail)
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: {
        contractor_email: normalizedEmail,
        plan_id: planId,
        stripe_customer_id: stripeCustomerId
      },
      subscription_data: {
        metadata: {
          contractor_email: normalizedEmail,
          plan_id: planId,
          stripe_customer_id: stripeCustomerId
        }
      }
    })

    await serviceClient
      .from("contractor_subscriptions")
      .upsert({
        contractor_email: normalizedEmail,
        plan_id: planId,
        status: "incomplete",
        stripe_customer_id: stripeCustomerId,
        stripe_checkout_session_id: session.id,
        stripe_price_id: priceId,
        metadata: {
          latest_checkout_session_id: session.id
        }
      }, { onConflict: "contractor_email" })

    return Response.json({ url: session.url, sessionId: session.id }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500, headers: corsHeaders })
  }
})
