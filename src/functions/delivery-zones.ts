import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { deliveryZones } from "@/db/schema";
import { requireStaff } from "./auth";
import { logActivity } from "@/lib/activity-log";

// ─────────────────────────────────────────────────────────────
// Public: active delivery areas, for the customer checkout dropdown
// ─────────────────────────────────────────────────────────────

export const getActiveDeliveryZones = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await db.query.deliveryZones.findMany({
    where: eq(deliveryZones.active, true),
    orderBy: asc(deliveryZones.sortOrder),
  });
  return rows.map((zone) => ({ id: zone.id, name: zone.name, fee: Number(zone.fee) }));
});

// ─────────────────────────────────────────────────────────────
// Management: Admin and Super Admin only
// ─────────────────────────────────────────────────────────────

export const listDeliveryZones = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: ["admin", "super_admin"] });
  return db.query.deliveryZones.findMany({ orderBy: asc(deliveryZones.sortOrder) });
});

const saveZoneSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(120),
  fee: z.number().nonnegative(),
});

export const saveDeliveryZone = createServerFn({ method: "POST" })
  .validator(saveZoneSchema)
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: ["admin", "super_admin"] });

    if (data.id) {
      await db
        .update(deliveryZones)
        .set({ name: data.name, fee: data.fee.toFixed(2), updatedAt: new Date() })
        .where(eq(deliveryZones.id, data.id));

      await logActivity({
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated delivery area "${data.name}" (GH₵${data.fee.toFixed(2)})`,
        entityType: "delivery_zone",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const existing = await db.query.deliveryZones.findMany();
    const [inserted] = await db
      .insert(deliveryZones)
      .values({ name: data.name, fee: data.fee.toFixed(2), sortOrder: existing.length })
      .returning({ id: deliveryZones.id });
    if (!inserted) throw new Error("Failed to create delivery area.");

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created delivery area "${data.name}" (GH₵${data.fee.toFixed(2)})`,
      entityType: "delivery_zone",
      entityId: inserted.id,
    });
    return { id: inserted.id };
  });

export const setDeliveryZoneActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: ["admin", "super_admin"] });
    await db
      .update(deliveryZones)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(deliveryZones.id, data.id));

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `${data.active ? "Activated" : "Deactivated"} delivery area #${data.id}`,
      entityType: "delivery_zone",
      entityId: data.id,
    });
    return { success: true };
  });

export const deleteDeliveryZone = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: ["admin", "super_admin"] });
    // Orders that used this zone keep their snapshotted deliveryZoneName,
    // so deleting the zone here never changes past orders' displayed price/area.
    await db.delete(deliveryZones).where(eq(deliveryZones.id, data.id));

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted delivery area #${data.id}`,
      entityType: "delivery_zone",
      entityId: data.id,
    });
    return { success: true };
  });
