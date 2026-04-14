import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@16.10.0"
import { corsHeaders } from "../_shared/cors.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("stripe_secret_key") || "", {
  apiVersion: "2024-06-20"
})

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

function toIsoFromUnix(timestamp?: number | null) {
  if (!timestamp) return null
  return new Date(timestamp * 1000).toISOString()
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const mode = session.mode
  const metadata = session.metadata || {}

  if (mode === "subscription") {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
    if (!subscriptionId) return

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const contractorEmail = String(metadata.contractor_email || "").trim().toLowerCase()
    const planId = String(metadata.plan_id || "")
    const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id
    const priceId = subscription.items.data[0]?.price?.id || null

    await serviceClient
      .from("profiles")
      .update({
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString()
      })
      .eq("email", contractorEmail)

    await serviceClient
      .from("contractor_subscriptions")
      .upsert({
        contractor_email: contractorEmail,
        plan_id: planId,
        status: subscription.status,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        stripe_checkout_session_id: session.id,
        stripe_price_id: priceId,
        current_period_end: toIsoFromUnix(subscription.items.data[0]?.current_period_end || subscription.current_period_end),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        metadata: subscription
      }, { onConflict: "contractor_email" })

    return
  }

  if (mode === "payment") {
    const invoiceId = String(metadata.invoice_id || "")
    if (!invoiceId) return

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null
    let chargeId = null
    let transferId = null

    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] })
      chargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id || null
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId)
        transferId = typeof charge.transfer === "string" ? charge.transfer : charge.transfer?.id || null
      }
    }

    await serviceClient
      .from("invoice_payments")
      .update({
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: chargeId,
        stripe_transfer_id: transferId,
        status: "paid",
        payment_method: "stripe_checkout",
        payment_reference: session.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("stripe_checkout_session_id", session.id)

    await serviceClient
      .from("invoices")
      .update({
        status: "paid",
        payment_method: "stripe_checkout",
        payment_reference: session.id,
        paid_amount: Number(session.amount_total || 0) / 100,
        paid_by_name: session.customer_details?.name || session.customer_details?.email || "",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", invoiceId)
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const contractorEmail = String(subscription.metadata?.contractor_email || "").trim().toLowerCase()
  const planId = String(subscription.metadata?.plan_id || "")
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id
  const priceId = subscription.items.data[0]?.price?.id || null

  if (contractorEmail) {
    await serviceClient
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
      .eq("email", contractorEmail)
  }

  await serviceClient
    .from("contractor_subscriptions")
    .upsert({
      contractor_email: contractorEmail,
      plan_id: planId || "solo",
      status: subscription.status,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_end: toIsoFromUnix(subscription.items.data[0]?.current_period_end || subscription.current_period_end),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      metadata: subscription
    }, { onConflict: "contractor_email" })
}

async function handleAccountUpdated(account: Stripe.Account) {
  await serviceClient
    .from("profiles")
    .update({
      stripe_connect_onboarding_complete: Boolean(account.charges_enabled && account.payouts_enabled),
      stripe_connect_details_submitted: Boolean(account.details_submitted),
      updated_at: new Date().toISOString()
    })
    .eq("stripe_connect_account_id", account.id)
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const signature = request.headers.get("stripe-signature") || ""
    const body = await request.text()
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break
      default:
        break
    }

    return Response.json({ received: true }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400, headers: corsHeaders })
  }
})
