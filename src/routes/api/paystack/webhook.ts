// Paystack webhook receiver.
//
// NOTE ON TANSTACK START VERSION: this file uses `createServerFileRoute`,
// the current documented pattern for a raw HTTP API route in TanStack Start.
// This project pins fairly recent/pre-release versions of
// @tanstack/react-router and @tanstack/react-start (1.170.x / 1.168.x) that
// postdate this assistant's training data — if the build reports that
// `createServerFileRoute` doesn't exist or has a different signature, check
// node_modules/@tanstack/react-start's type definitions / the TanStack Start
// docs for the exact API route convention for your installed version and
// adjust the export below accordingly. The handler logic itself (signature
// verification + applyPaymentResult) does not need to change.
import { createServerFileRoute } from "@tanstack/react-start/server";
import crypto from "node:crypto";
import { applyPaymentResult } from "@/server/payments";

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const ServerRoute = createServerFileRoute("/api/paystack/webhook").methods({
  POST: async ({ request }) => {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    if (!verifySignature(rawBody, signature)) {
      // Do not process — this either isn't really from Paystack, or the
      // secret key is misconfigured. Respond 401 so it's visible in logs
      // without leaking details to whoever sent the request.
      return new Response("Invalid signature", { status: 401 });
    }

    let event: {
      event: string;
      data: { reference: string; status: string; [key: string]: unknown };
    };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }

    // We only care about the final charge outcome. Paystack sends several
    // event types (e.g. charge.success); ignore anything else quietly.
    if (event.event === "charge.success") {
      await applyPaymentResult({
        reference: event.data.reference,
        status: "success",
        rawData: event.data,
      });
    } else if (event.event === "charge.failed") {
      await applyPaymentResult({
        reference: event.data.reference,
        status: "failed",
        rawData: event.data,
      });
    }

    // Always 200 on anything we successfully parsed and verified, per
    // Paystack's retry semantics — otherwise they'll keep re-sending it.
    return new Response("ok", { status: 200 });
  },
});
