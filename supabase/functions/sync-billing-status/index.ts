import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@16.10.0"
import { corsHeaders } from "../_shared/cors.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("stripe_secret_key") || "", {
  apiVersion: "2024-06-20"
})

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

function toIsoFromUnix(timestamp?: number | null) {
  if (!timestamp) return null
  return new Date(timestamp * 1000).toISOString()
}

async function getLatestSubscription(params: {
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripeCheckoutSessionId?: string
  email: string
}) {
  if (params.stripeSubscriptionId) {
    return stripe.subscriptions.retrieve(params.stripeSubscriptionId)
  }

  if (params.stripeCheckoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(params.stripeCheckoutSessionId)
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
    if (subscriptionId) {
      return stripe.subscriptions.retrieve(subscriptionId)
    }
  }

  if (params.stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: params.stripeCustomerId,
      status: "all",
      limit: 1
    })
    return subscriptions.data[0] || null
  }

  const customers = await stripe.customers.list({ email: params.email, limit: 1 })
  const customerId = customers.data[0]?.id
  if (!customerId) return null

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1
  })
  return subscriptions.data[0] || null
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

    const body = await request.json().catch(() => ({}))
    const syncSubscription = body?.subscription !== false
    const syncConnect = body?.connect !== false
    const normalizedEmail = user.email.trim().toLowerCase()

    const [{ data: profile }, { data: subscriptionRow }] = await Promise.all([
      serviceClient
        .from("profiles")
        .select("email, stripe_customer_id, stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_details_submitted")
        .eq("email", normalizedEmail)
        .maybeSingle(),
      serviceClient
        .from("contractor_subscriptions")
        .select("contractor_email, plan_id, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id, stripe_price_id, status")
        .eq("contractor_email", normalizedEmail)
        .maybeSingle()
    ])

    let subscriptionResult = null
    if (syncSubscription) {
      const subscription = await getLatestSubscription({
        stripeCustomerId: subscriptionRow?.stripe_customer_id || profile?.stripe_customer_id || "",
        stripeSubscriptionId: subscriptionRow?.stripe_subscription_id || "",
        stripeCheckoutSessionId: subscriptionRow?.stripe_checkout_session_id || "",
        email: normalizedEmail
      })

      if (subscription) {
        const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id
        const priceId = subscription.items.data[0]?.price?.id || subscriptionRow?.stripe_price_id || null

        await serviceClient
          .from("profiles")
          .update({
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString()
          })
          .eq("email", normalizedEmail)

        await serviceClient
          .from("contractor_subscriptions")
          .upsert({
            contractor_email: normalizedEmail,
            plan_id: subscriptionRow?.plan_id || String(subscription.metadata?.plan_id || "solo"),
            status: subscription.status,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: subscription.id,
            stripe_checkout_session_id: subscriptionRow?.stripe_checkout_session_id || null,
            stripe_price_id: priceId,
            current_period_end: toIsoFromUnix(subscription.items.data[0]?.current_period_end || subscription.current_period_end),
            cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
            metadata: subscription,
            updated_at: new Date().toISOString()
          }, { onConflict: "contractor_email" })

        subscriptionResult = {
          status: subscription.status,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: toIsoFromUnix(subscription.items.data[0]?.current_period_end || subscription.current_period_end)
        }
      }
    }

    let connectResult = null
    if (syncConnect && profile?.stripe_connect_account_id) {
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id)
      const nextValues = {
        stripe_connect_onboarding_complete: Boolean(account.charges_enabled && account.payouts_enabled),
        stripe_connect_details_submitted: Boolean(account.details_submitted),
        updated_at: new Date().toISOString()
      }

      await serviceClient
        .from("profiles")
        .update(nextValues)
        .eq("email", normalizedEmail)

      connectResult = {
        accountId: account.id,
        onboardingComplete: nextValues.stripe_connect_onboarding_complete,
        detailsSubmitted: nextValues.stripe_connect_details_submitted
      }
    }

    return Response.json({
      subscription: subscriptionResult,
      connect: connectResult
    }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500, headers: corsHeaders })
  }
})
