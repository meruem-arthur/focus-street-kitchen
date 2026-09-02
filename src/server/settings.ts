import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { requireStaff } from "./auth";

/** Current delivery fee in GHS. Falls back to 15 if not yet configured. */
export async function getDeliveryFee(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "delivery_fee") });
  return row ? Number(row.value) : 15;
}

export const getDeliveryFeeFn = createServerFn({ method: "GET" }).handler(async () => {
  return { deliveryFee: await getDeliveryFee() };
});

export const setDeliveryFee = createServerFn({ method: "POST" })
  .validator(z.object({ fee: z.number().nonnegative() }))
  .handler(async ({ data }) => {
    await requireStaff({ role: "admin" });
    await db
      .insert(settings)
      .values({ key: "delivery_fee", value: data.fee.toFixed(2) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: data.fee.toFixed(2), updatedAt: new Date() },
      });
    return { success: true };
  });
