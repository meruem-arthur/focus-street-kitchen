import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, menuItems } from "@/db/schema";
import { requireStaff } from "./auth";

export type PublicMenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
};

export type PublicCategory = {
  id: number;
  slug: string;
  title: string;
  blurb: string | null;
  layout: string;
  items: PublicMenuItem[];
};

/** Full menu, grouped by category, for the public site. */
export const getMenu = createServerFn({ method: "GET" }).handler(async (): Promise<PublicCategory[]> => {
  const cats = await db.query.categories.findMany({
    orderBy: asc(categories.sortOrder),
    with: {
      items: {
        orderBy: asc(menuItems.sortOrder),
      },
    },
  });

  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    blurb: c.blurb,
    layout: c.layout,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price: Number(i.price),
      imageUrl: i.imageUrl,
      available: i.available,
    })),
  }));
});

// ─────────────────────────────────────────────────────────────
// Admin/staff menu management
// ─────────────────────────────────────────────────────────────

const upsertItemSchema = z.object({
  id: z.number().optional(),
  categoryId: z.number(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  imageUrl: z.string().optional().nullable(),
  available: z.boolean(),
});

export const saveMenuItem = createServerFn({ method: "POST" })
  .validator(upsertItemSchema)
  .handler(async ({ data }) => {
    await requireStaff({ role: "admin" });

    if (data.id) {
      await db
        .update(menuItems)
        .set({
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? null,
          price: data.price.toFixed(2),
          imageUrl: data.imageUrl ?? null,
          available: data.available,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, data.id));
      return { id: data.id };
    }

    const [inserted] = await db
      .insert(menuItems)
      .values({
        categoryId: data.categoryId,
        name: data.name,
        description: data.description ?? null,
        price: data.price.toFixed(2),
        imageUrl: data.imageUrl ?? null,
        available: data.available,
      })
      .returning({ id: menuItems.id });

    return { id: inserted.id };
  });

export const setItemAvailability = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), available: z.boolean() }))
  .handler(async ({ data }) => {
    await requireStaff();
    await db
      .update(menuItems)
      .set({ available: data.available, updatedAt: new Date() })
      .where(eq(menuItems.id, data.id));
    return { success: true };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await requireStaff({ role: "admin" });
    await db.delete(menuItems).where(eq(menuItems.id, data.id));
    return { success: true };
  });
