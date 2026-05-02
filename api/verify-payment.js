// api/verify-payment.js — Server-side Stripe payment verification
// Called by the frontend after Stripe redirects back with a session_id.
// The browser never receives sensitive Stripe data — only a verified plan name.

import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  const { session_id } = req.query;

  // Validate session_id format (Stripe checkout sessions start with "cs_")
  if (
    !session_id ||
    typeof session_id !== "string" ||
    session_id.length > 200 ||
    !session_id.startsWith("cs_")
  ) {
    return res.status(400).json({ error: "ID de session invalide." });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("[api/verify-payment] STRIPE_SECRET_KEY manquante.");
    return res.status(500).json({ error: "Service de paiement indisponible." });
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Accept "paid" or "trialing" (7-day free trial) as valid
    const isValid =
      session.payment_status === "paid" ||
      session.status === "complete" ||
      // subscription in trial: payment_status is "no_payment_needed"
      (session.mode === "subscription" && session.status === "complete");

    if (!isValid) {
      return res
        .status(402)
        .json({ verified: false, error: "Paiement non confirmé." });
    }

    const plan = session.metadata?.plan;
    if (!["premium", "famille"].includes(plan)) {
      return res.status(400).json({ error: "Plan invalide dans la session." });
    }

    return res.status(200).json({
      verified: true,
      plan,
      email: session.customer_email || session.metadata?.email || "",
    });
  } catch (err) {
    console.error("[api/verify-payment] Stripe error:", err.message);
    return res
      .status(500)
      .json({ error: "Impossible de vérifier le paiement." });
  }
}
