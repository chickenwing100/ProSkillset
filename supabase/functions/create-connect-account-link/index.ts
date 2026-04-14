import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@16.10.0"
import { corsHeaders } from "../_shared/cors.ts"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || Deno.env.get("stripe_secret_key") || "", {
  apiVersion: "2024-06-20"
})

const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

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
    const returnUrl = String(body?.returnUrl || "")
    const refreshUrl = String(body?.refreshUrl || returnUrl)

    if (!returnUrl) {
      return Response.json({ error: "Missing return URL" }, { status: 400, headers: corsHeaders })
    }

    const normalizedEmail = user.email.trim().toLowerCase()

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("email, full_name, business_name, stripe_connect_account_id")
      .eq("email", normalizedEmail)
      .maybeSingle()

    let stripeConnectAccountId = profile?.stripe_connect_account_id || ""
    if (!stripeConnectAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: normalizedEmail,
        business_type: "company",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        metadata: {
          email: normalizedEmail,
          supabase_user_id: user.id
        }
      })
      stripeConnectAccountId = account.id

      await serviceClient
        .from("profiles")
        .update({
          stripe_connect_account_id: stripeConnectAccountId,
          stripe_connect_onboarding_complete: false,
          stripe_connect_details_submitted: false,
          updated_at: new Date().toISOString()
        })
        .eq("email", normalizedEmail)
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    })

    return Response.json({ url: accountLink.url, accountId: stripeConnectAccountId }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500, headers: corsHeaders })
  }
})
