import { createServerFn } from "@tanstack/react-start";
import * as bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { staff } from "@/db/schema";
import { requireStaff } from "./auth";
import { logActivity } from "@/lib/activity-log";

const usernamePattern = /^[a-z0-9._-]{3,40}$/;

function publicShape(row: typeof staff.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Staff Management — used by Admin to manage Staff accounts.
// ─────────────────────────────────────────────────────────────

export const listStaffAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: "admin" });
  const rows = await db.query.staff.findMany({
    where: eq(staff.role, "staff"),
    orderBy: (fields, { asc }) => asc(fields.name),
  });
  return rows.map(publicShape);
});

const createStaffSchema = z.object({
  name: z.string().min(1).max(120),
  username: z.string().regex(usernamePattern, "Username must be 3-40 chars: letters, numbers, . _ -"),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const createStaffAccount = createServerFn({ method: "POST" })
  .validator(createStaffSchema)
  .handler(async ({ data }) => {
    const admin = await requireStaff({ role: "admin" });

    const username = data.username.toLowerCase();
    const existing = await db.query.staff.findFirst({ where: eq(staff.username, username) });
    if (existing) throw new Error("That username is already taken.");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const [inserted] = await db
      .insert(staff)
      .values({
        name: data.name,
        username,
        passwordHash,
        role: "staff",
        active: true,
        createdByStaffId: admin.id,
      })
      .returning();
    if (!inserted) throw new Error("Failed to create staff account.");

    await logActivity({
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Created staff account "${data.name}" (${username})`,
      entityType: "staff",
      entityId: inserted.id,
    });

    return publicShape(inserted);
  });

const updateStaffSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(120),
  username: z.string().regex(usernamePattern, "Username must be 3-40 chars: letters, numbers, . _ -"),
});

export const updateStaffAccount = createServerFn({ method: "POST" })
  .validator(updateStaffSchema)
  .handler(async ({ data }) => {
    const admin = await requireStaff({ role: "admin" });

    const target = await db.query.staff.findFirst({ where: eq(staff.id, data.id) });
    if (!target || target.role !== "staff") throw new Error("Staff account not found.");

    const username = data.username.toLowerCase();
    const clash = await db.query.staff.findFirst({
      where: and(eq(staff.username, username), ne(staff.id, data.id)),
    });
    if (clash) throw new Error("That username is already taken.");

    await db
      .update(staff)
      .set({ name: data.name, username, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Updated staff account "${data.name}" (${username})`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const admin = await requireStaff({ role: "admin" });

    const target = await db.query.staff.findFirst({ where: eq(staff.id, data.id) });
    if (!target || target.role !== "staff") throw new Error("Staff account not found.");

    await db
      .update(staff)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `${data.active ? "Activated" : "Deactivated"} staff account "${target.name}"`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), newPassword: z.string().min(8) }))
  .handler(async ({ data }) => {
    const admin = await requireStaff({ role: "admin" });

    const target = await db.query.staff.findFirst({ where: eq(staff.id, data.id) });
    if (!target || target.role !== "staff") throw new Error("Staff account not found.");

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await db
      .update(staff)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Reset password for staff account "${target.name}"`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const admin = await requireStaff({ role: "admin" });

    const target = await db.query.staff.findFirst({ where: eq(staff.id, data.id) });
    if (!target || target.role !== "staff") throw new Error("Staff account not found.");

    // Deactivate rather than hard-delete, so past order-status-history and
    // activity-log entries attributed to this person stay intact.
    await db
      .update(staff)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Removed staff account "${target.name}"`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// Super Admin — manage Admin (business owner/manager) accounts.
// Deliberately separate functions from the Staff ones above so an
// Admin's server-side permissions can never reach Admin accounts,
// and a Super Admin's can never reach order/financial data.
// ─────────────────────────────────────────────────────────────

export const listAdminAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: "super_admin" });
  const rows = await db.query.staff.findMany({
    where: eq(staff.role, "admin"),
    orderBy: (fields, { asc }) => asc(fields.name),
  });
  return rows.map(publicShape);
});

const createAdminSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const createAdminAccount = createServerFn({ method: "POST" })
  .validator(createAdminSchema)
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });

    const email = data.email.toLowerCase();
    const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
    if (existing) throw new Error("That email is already registered.");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const [inserted] = await db
      .insert(staff)
      .values({
        name: data.name,
        email,
        passwordHash,
        role: "admin",
        active: true,
        createdByStaffId: superAdmin.id,
      })
      .returning();
    if (!inserted) throw new Error("Failed to create admin account.");

    await logActivity({
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Created admin account "${data.name}" (${email})`,
      entityType: "admin",
      entityId: inserted.id,
    });

    return publicShape(inserted);
  });

export const setAdminActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });

    const target = await db.query.staff.findFirst({ where: eq(staff.id, data.id) });
    if (!target || target.role !== "admin") throw new Error("Admin account not found.");

    await db
      .update(staff)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `${data.active ? "Activated" : "Deactivated"} admin account "${target.name}"`,
      entityType: "admin",
      entityId: data.id,
    });

    return { success: true };
  });

export const resetAdminPassword = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), newPassword: z.string().min(8) }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });

    const target = await db.query.staff.findFirst({ where: eq(staff.id, data.id) });
    if (!target || target.role !== "admin") throw new Error("Admin account not found.");

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await db
      .update(staff)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Reset password for admin account "${target.name}"`,
      entityType: "admin",
      entityId: data.id,
    });

    return { success: true };
  });
