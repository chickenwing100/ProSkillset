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
    const invoiceId = String(body?.invoiceId || "")
    const successUrl = String(body?.successUrl || "")
    const cancelUrl = String(body?.cancelUrl || "")

    if (!invoiceId || !successUrl || !cancelUrl) {
      return Response.json({ error: "Missing invoice ID or redirect URLs" }, { status: 400, headers: corsHeaders })
    }

    const normalizedEmail = user.email.trim().toLowerCase()
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404, headers: corsHeaders })
    }

    if (String(invoice.client_email || "").trim().toLowerCase() !== normalizedEmail) {
      return Response.json({ error: "You are not allowed to pay this invoice" }, { status: 403, headers: corsHeaders })
    }

    if (String(invoice.status || "").toLowerCase() === "paid") {
      return Response.json({ error: "Invoice is already paid" }, { status: 400, headers: corsHeaders })
    }

    const { data: contractorProfile } = await serviceClient
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("email", String(invoice.contractor_email || "").trim().toLowerCase())
      .maybeSingle()

    if (!contractorProfile?.stripe_connect_account_id || !contractorProfile?.stripe_connect_onboarding_complete) {
      return Response.json({ error: "Contractor payouts are not ready yet" }, { status: 400, headers: corsHeaders })
    }

    const amount = Math.round(Number(invoice.amount || 0) * 100)
    if (!amount || amount <= 0) {
      return Response.json({ error: "Invoice amount is invalid" }, { status: 400, headers: corsHeaders })
    }

    const name = invoice.related_job_title
      ? `Invoice for ${invoice.related_job_title}`
      : `Invoice ${invoice.id}`

    const descriptionParts = [
      invoice.related_job_po_number ? `PO# ${invoice.related_job_po_number}` : "",
      invoice.description || ""
    ].filter(Boolean)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: normalizedEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name,
              description: descriptionParts.join(" • ") || undefined
            }
          }
        }
      ],
      payment_intent_data: {
        transfer_data: {
          destination: contractorProfile.stripe_connect_account_id
        },
        metadata: {
          invoice_id: invoice.id,
          contractor_email: String(invoice.contractor_email || "").trim().toLowerCase(),
          client_email: normalizedEmail
        }
      },
      metadata: {
        invoice_id: invoice.id,
        contractor_email: String(invoice.contractor_email || "").trim().toLowerCase(),
        client_email: normalizedEmail
      }
    })

    await serviceClient
      .from("invoice_payments")
      .upsert({
        invoice_id: invoice.id,
        client_email: normalizedEmail,
        contractor_email: String(invoice.contractor_email || "").trim().toLowerCase(),
        stripe_checkout_session_id: session.id,
        stripe_connected_account_id: contractorProfile.stripe_connect_account_id,
        amount: Number(invoice.amount || 0),
        currency: "usd",
        status: "open",
        metadata: {
          payment_stage: invoice.payment_stage || "full"
        }
      }, { onConflict: "stripe_checkout_session_id" })

    return Response.json({ url: session.url, sessionId: session.id }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500, headers: corsHeaders })
  }
})
