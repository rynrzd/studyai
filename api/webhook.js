// api/webhook.js — Stripe webhook receiver
// Verifies Stripe signature before processing any event.
// bodyParser MUST be disabled so we receive the raw body for signature verification.

import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error("[webhook] Stripe keys missing.");
    return res.status(500).end();
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  // ── Signature verification (mandatory — prevents spoofed events) ───────────
  let event;
  try {
    const rawBody = await readRawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    // Do NOT log the raw error — it may contain sensitive details
    console.error("[webhook] Signature verification failed.");
    return res.status(400).end();
  }

  // ── Handle relevant events ────────────────────────────────────────────────
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const plan = session.metadata?.plan;
      const email = session.customer_email || session.metadata?.email;
      // Audit log only — no sensitive data exposed
      console.log(
        `[webhook] checkout.session.completed — plan=${plan} customer=${email ? email.substring(0, 3) + "***" : "unknown"}`
      );
      // With a backend database (e.g. Supabase): update user plan here.
      // Current architecture uses client-side verification via /api/verify-payment.
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      console.log(
        `[webhook] subscription.updated — status=${sub.status} id=${sub.id}`
      );
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      console.log(
        `[webhook] subscription.deleted — id=${sub.id}`
      );
      // With Supabase: find user by Stripe customer ID and downgrade their plan.
      break;
    }

    case "invoice.payment_failed": {
      console.log(`[webhook] invoice.payment_failed — ${event.data.object.id}`);
      break;
    }

    default:
      // Ignore unhandled event types
      break;
  }

  return res.status(200).json({ received: true });
}
