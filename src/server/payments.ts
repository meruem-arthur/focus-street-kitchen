import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { orders, payments } from "@/db/schema";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set. Add it to .env (see .env.example).");
  }
  return key;
}

// ─────────────────────────────────────────────────────────────
// Initialize a transaction for an existing (pending) order
// ─────────────────────────────────────────────────────────────

export const initializePayment = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.number(), callbackUrl: z.string().url().optional() }))
  .handler(async ({ data }) => {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, data.orderId) });
    if (!order) throw new Error("Order not found.");
    if (order.paymentStatus === "paid") throw new Error("This order has already been paid for.");

    // Paystack reference must be unique — order number plus a short random
    // suffix so retries after a failed attempt don't collide.
    const reference = `${order.orderNumber}-${Date.now().toString(36)}`;
    const amountInPesewas = Math.round(Number(order.total) * 100);

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: order.customerEmail || `${order.customerPhone.replace(/\D/g, "")}@focusstreetkitchen.local`,
        amount: amountInPesewas,
        currency: "GHS",
        reference,
        ...(data.callbackUrl ? { callback_url: data.callbackUrl } : {}),
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber,
          customer_name: order.customerName,
        },
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.status) {
      throw new Error(json.message ?? "Could not start payment with Paystack.");
    }

    await db.insert(payments).values({
      orderId: order.id,
      provider: "paystack",
      reference,
      amount: order.total,
      currency: "GHS",
      status: "pending",
      rawData: JSON.stringify(json.data),
    });

    await db.update(orders).set({ paymentReference: reference }).where(eq(orders.id, order.id));

    return {
      authorizationUrl: json.data.authorization_url as string,
      reference,
    };
  });

// ─────────────────────────────────────────────────────────────
// Verify a transaction (used on the checkout return page as a belt-and-braces
// check in addition to the webhook, which is the source of truth)
// ─────────────────────────────────────────────────────────────

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getSecretKey()}` },
  });
  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message ?? "Could not verify payment with Paystack.");
  }
  return json.data as {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    currency: string;
  };
}

/** Applies a verified Paystack result to our payment + order rows. Idempotent. */
export async function applyPaymentResult(data: {
  reference: string;
  status: "success" | "failed" | "abandoned";
  rawData: unknown;
}) {
  const payment = await db.query.payments.findFirst({ where: eq(payments.reference, data.reference) });
  if (!payment) {
    // Unknown reference — ignore rather than throw, so retried webhooks for
    // transactions we don't recognize don't produce noisy 500s to Paystack.
    return { handled: false };
  }

  // Already processed — webhooks and manual verification can both fire for
  // the same event, so make this a no-op the second time.
  if (payment.status === "paid" || payment.status === "failed") {
    return { handled: true, alreadyProcessed: true };
  }

  const newStatus = data.status === "success" ? "paid" : "failed";

  await db
    .update(payments)
    .set({ status: newStatus, rawData: JSON.stringify(data.rawData), updatedAt: new Date() })
    .where(eq(payments.id, payment.id));

  await db
    .update(orders)
    .set({
      paymentStatus: newStatus,
      // a paid order moves itself to "accepted" so staff see it immediately
      // in the active queue rather than sitting in a raw "pending" state
      orderStatus: newStatus === "paid" ? "accepted" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, payment.orderId));

  return { handled: true, alreadyProcessed: false };
}

export const verifyPaymentFn = createServerFn({ method: "POST" })
  .validator(z.object({ reference: z.string() }))
  .handler(async ({ data }) => {
    const result = await verifyPaystackTransaction(data.reference);
    await applyPaymentResult({ reference: result.reference, status: result.status, rawData: result });
    return { status: result.status };
  });
