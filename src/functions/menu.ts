import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, menuItems, menuItemVariants } from "@/db/schema";
import { requireStaff } from "./auth";
import { logActivity } from "@/lib/activity-log";

// Menu management is platform/business content — both Admin and Super
// Admin may manage it. Staff (operational role) may not.
const MENU_MANAGER_ROLES = ["admin", "super_admin"] as const;

export type PublicMenuItemVariant = {
  id: number;
  label: string | null;
  price: number;
};

export type PublicMenuItem = {
  id: number;
  name: string;
  description: string | null;
  // Null when this item has price options instead — see `variants`.
  price: number | null;
  variants: PublicMenuItemVariant[];
  imageUrl: string | null;
  available: boolean;
};

export type PublicCategory = {
  id: number;
  slug: string;
  title: string;
  blurb: string | null;
  layout: string;
  sortOrder: number;
  items: PublicMenuItem[];
};

/** Full menu, grouped by category, for the public site. */
export const getMenu = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCategory[]> => {
    const cats = await db.query.categories.findMany({
      orderBy: asc(categories.sortOrder),
      with: {
        items: {
          orderBy: asc(menuItems.sortOrder),
          with: {
            variants: { orderBy: asc(menuItemVariants.sortOrder) },
          },
        },
      },
    });

    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      blurb: c.blurb,
      layout: c.layout,
      sortOrder: c.sortOrder,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: i.price === null ? null : Number(i.price),
        variants: i.variants.map((v) => ({
          id: v.id,
          label: v.label,
          price: Number(v.price),
        })),
        imageUrl: i.imageUrl,
        available: i.available,
      })),
    }));
  },
);

// ─────────────────────────────────────────────────────────────
// Admin/staff menu management
// ─────────────────────────────────────────────────────────────

const variantInputSchema = z.object({
  label: z.string().max(60).optional().nullable(),
  price: z.number().positive(),
});

const upsertItemSchema = z
  .object({
    id: z.number().optional(),
    categoryId: z.number(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    // Exactly one of `price` / `variants` is used — a plain single price,
    // or 2+ price options (e.g. Loaded Fries GH₵70/100). Validated below
    // rather than with a zod union, since the error messages read better.
    price: z.number().positive().optional(),
    variants: z.array(variantInputSchema).optional(),
    imageUrl: z.string().optional().nullable(),
    available: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const variants = data.variants ?? [];
    if (variants.length === 0) {
      if (data.price === undefined) {
        ctx.addIssue({ code: "custom", message: "Enter a price for this item." });
      }
      return;
    }
    if (variants.length === 1) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least 2 price options, or remove price options and set a single price.",
      });
    }
  });

async function replaceVariants(
  menuItemId: number,
  variants: { label?: string | null; price: number }[],
) {
  await db.delete(menuItemVariants).where(eq(menuItemVariants.menuItemId, menuItemId));
  if (variants.length === 0) return;
  await db.insert(menuItemVariants).values(
    variants.map((v, i) => ({
      menuItemId,
      label: v.label?.trim() || null,
      price: v.price.toFixed(2),
      sortOrder: i,
    })),
  );
}

export const saveMenuItem = createServerFn({ method: "POST" })
  .validator(upsertItemSchema)
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: MENU_MANAGER_ROLES });
    const hasVariants = (data.variants?.length ?? 0) >= 2;

    if (data.id) {
      await db
        .update(menuItems)
        .set({
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? null,
          price: hasVariants ? null : (data.price?.toFixed(2) ?? null),
          imageUrl: data.imageUrl ?? null,
          available: data.available,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, data.id));

      await replaceVariants(data.id, hasVariants ? data.variants! : []);

      await logActivity({
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated menu item "${data.name}"`,
        entityType: "menu_item",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const [inserted] = await db
      .insert(menuItems)
      .values({
        categoryId: data.categoryId,
        name: data.name,
        description: data.description ?? null,
        price: hasVariants ? null : (data.price?.toFixed(2) ?? null),
        imageUrl: data.imageUrl ?? null,
        available: data.available,
      })
      .returning({ id: menuItems.id });

    if (hasVariants) {
      await replaceVariants(inserted.id, data.variants!);
    }

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created menu item "${data.name}"`,
      entityType: "menu_item",
      entityId: inserted.id,
    });

    return { id: inserted.id };
  });

export const setItemAvailability = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), available: z.boolean() }))
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: MENU_MANAGER_ROLES });
    await db
      .update(menuItems)
      .set({ available: data.available, updatedAt: new Date() })
      .where(eq(menuItems.id, data.id));

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Marked menu item #${data.id} as ${data.available ? "available" : "unavailable"}`,
      entityType: "menu_item",
      entityId: data.id,
    });
    return { success: true };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: MENU_MANAGER_ROLES });
    await db.delete(menuItems).where(eq(menuItems.id, data.id));

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted menu item #${data.id}`,
      entityType: "menu_item",
      entityId: data.id,
    });
    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// Category management (Admin + Super Admin)
// ─────────────────────────────────────────────────────────────

const saveCategorySchema = z.object({
  id: z.number().optional(),
  slug: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  blurb: z.string().optional().nullable(),
  layout: z.enum(["list", "grid", "triple"]).default("list"),
  sortOrder: z.number().default(0),
});

export const saveCategory = createServerFn({ method: "POST" })
  .validator(saveCategorySchema)
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: MENU_MANAGER_ROLES });

    if (data.id) {
      await db
        .update(categories)
        .set({
          slug: data.slug,
          title: data.title,
          blurb: data.blurb ?? null,
          layout: data.layout,
          sortOrder: data.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, data.id));

      await logActivity({
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated category "${data.title}"`,
        entityType: "category",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const [inserted] = await db
      .insert(categories)
      .values({
        slug: data.slug,
        title: data.title,
        blurb: data.blurb ?? null,
        layout: data.layout,
        sortOrder: data.sortOrder,
      })
      .returning({ id: categories.id });

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created category "${data.title}"`,
      entityType: "category",
      entityId: inserted.id,
    });
    return { id: inserted.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: MENU_MANAGER_ROLES });
    await db.delete(categories).where(eq(categories.id, data.id));

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted category #${data.id}`,
      entityType: "category",
      entityId: data.id,
    });
    return { success: true };
  });
