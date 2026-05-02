// api/checkout.js — Create a Stripe Checkout session (server-side only)
// The secret key never touches the browser.

import Stripe from "stripe";

// Stripe Price IDs must be created in your Stripe dashboard and stored in env vars.
// See .env.example for the expected variable names.
const PRICE_IDS = {
  premium: process.env.STRIPE_PRICE_PREMIUM,
  famille: process.env.STRIPE_PRICE_FAMILLE,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("[api/checkout] STRIPE_SECRET_KEY manquante.");
    return res.status(500).json({ error: "Service de paiement indisponible." });
  }

  const { plan, email } = req.body || {};

  if (!["premium", "famille"].includes(plan)) {
    return res.status(400).json({ error: "Plan invalide." });
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    console.error(`[api/checkout] STRIPE_PRICE_${plan.toUpperCase()} manquante.`);
    return res
      .status(500)
      .json({ error: "Configuration tarif manquante. Contacte le support." });
  }

  // Derive the app origin for redirect URLs
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
  const origin = `${proto}://${host}`;

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      // On success: Stripe redirects back with session_id for server-side verification
      success_url: `${origin}/?payment_success=1&session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: `${origin}/?payment_cancelled=1`,
      ...(email ? { customer_email: email } : {}),
      metadata: { plan, email: email || "" },
      // 7-day free trial for premium
      ...(plan === "premium"
        ? { subscription_data: { trial_period_days: 7 } }
        : {}),
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[api/checkout] Stripe error:", err.message);
    return res
      .status(500)
      .json({ error: "Impossible de créer la session de paiement." });
  }
}
