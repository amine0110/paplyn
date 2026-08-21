import Stripe from "stripe";
import { config } from "./config";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!config.isSaas || !config.stripe.secretKey) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(config.stripe.secretKey);
  }
  return stripeInstance;
}

export async function createCheckoutSession(
  customerId: string | null,
  priceId: string,
  userId: string,
  userEmail: string
) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId || undefined,
    customer_email: customerId ? undefined : userEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.appUrl}/settings/billing?success=true`,
    cancel_url: `${config.appUrl}/settings/billing?canceled=true`,
    metadata: { userId },
  });

  return session;
}

export async function createPortalSession(customerId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${config.appUrl}/settings/billing`,
  });

  return session;
}
