import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { promotions } from "@/db/schema";
import { requireStaff } from "./auth";
import { logActivity } from "@/lib/activity-log";

/** Promotions currently in their active window, for the public storefront. */
export const getActivePromotions = createServerFn({ method: "GET" }).handler(async () => {
  const now = new Date();
  const rows = await db.query.promotions.findMany({
    where: and(
      eq(promotions.active, true),
      or(isNull(promotions.startDate), lte(promotions.startDate, now)),
      or(isNull(promotions.endDate), gte(promotions.endDate, now)),
    ),
    orderBy: desc(promotions.createdAt),
  });
  return rows;
});

/** Full promotions list for management — reachable by Admin and Super Admin. */
export const listPromotions = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: ["admin", "super_admin"] });
  return db.query.promotions.findMany({ orderBy: desc(promotions.createdAt) });
});

const savePromoSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1).max(160),
  description: z.string().optional().nullable(),
  badgeText: z.string().max(120).optional().nullable(),
  active: z.boolean(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const savePromotion = createServerFn({ method: "POST" })
  .validator(savePromoSchema)
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: ["admin", "super_admin"] });

    const values = {
      title: data.title,
      description: data.description ?? null,
      badgeText: data.badgeText ?? null,
      active: data.active,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db.update(promotions).set(values).where(eq(promotions.id, data.id));
      await logActivity({
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated promotion "${data.title}"`,
        entityType: "promotion",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const [inserted] = await db.insert(promotions).values(values).returning({ id: promotions.id });
    if (!inserted) throw new Error("Failed to create promotion.");
    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created promotion "${data.title}"`,
      entityType: "promotion",
      entityId: inserted.id,
    });
    return { id: inserted.id };
  });

export const setPromotionActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: ["admin", "super_admin"] });
    await db
      .update(promotions)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(promotions.id, data.id));

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `${data.active ? "Activated" : "Deactivated"} promotion #${data.id}`,
      entityType: "promotion",
      entityId: data.id,
    });
    return { success: true };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: ["admin", "super_admin"] });
    await db.delete(promotions).where(eq(promotions.id, data.id));

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted promotion #${data.id}`,
      entityType: "promotion",
      entityId: data.id,
    });
    return { success: true };
  });
