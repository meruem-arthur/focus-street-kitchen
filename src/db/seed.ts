// Run with: bun run db:seed  (or: bun run --env-file=.env src/db/seed.ts)
// Safe to re-run: categories/items are upserted by slug/name, settings by key,
// and the admin account is only created if it doesn't already exist.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "./client.ts";
import { categories, menuItems, settings, staff } from "./schema.ts";
import { MENU_SEED } from "../data/menu-seed.ts";

async function seedMenu() {
  for (let i = 0; i < MENU_SEED.length; i++) {
    const cat = MENU_SEED[i];

    const existing = await db.query.categories.findFirst({
      where: eq(categories.slug, cat.slug),
    });

    const categoryId = existing
      ? existing.id
      : (
          await db
            .insert(categories)
            .values({
              slug: cat.slug,
              title: cat.title,
              blurb: cat.blurb,
              layout: cat.layout,
              sortOrder: i,
            })
            .returning({ id: categories.id })
        )[0].id;

    if (existing) {
      await db
        .update(categories)
        .set({ title: cat.title, blurb: cat.blurb, layout: cat.layout, sortOrder: i, updatedAt: new Date() })
        .where(eq(categories.id, categoryId));
    }

    for (let j = 0; j < cat.items.length; j++) {
      const item = cat.items[j];
      const existingItem = await db.query.menuItems.findFirst({
        where: and(eq(menuItems.categoryId, categoryId), eq(menuItems.name, item.name)),
      });

      if (existingItem) {
        await db
          .update(menuItems)
          .set({
            description: item.desc ?? null,
            price: item.price.toFixed(2),
            sortOrder: j,
            updatedAt: new Date(),
          })
          .where(eq(menuItems.id, existingItem.id));
      } else {
        await db.insert(menuItems).values({
          categoryId,
          name: item.name,
          description: item.desc ?? null,
          price: item.price.toFixed(2),
          available: true,
          sortOrder: j,
        });
      }
    }

    console.log(`✓ ${cat.title} (${cat.items.length} items)`);
  }
}

async function seedSettings() {
  const defaults: Record<string, string> = {
    delivery_fee: "15.00",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });
    if (!existing) {
      await db.insert(settings).values({ key, value });
      console.log(`✓ setting ${key} = ${value}`);
    }
  }
}

async function seedAdmin() {
  const email = process.env.STAFF_ADMIN_EMAIL;
  const password = process.env.STAFF_ADMIN_PASSWORD;
  const name = process.env.STAFF_ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    console.log(
      "Skipping admin account — set STAFF_ADMIN_EMAIL and STAFF_ADMIN_PASSWORD in .env to create one.",
    );
    return;
  }

  const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
  if (existing) {
    console.log(`✓ admin account already exists (${email})`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(staff).values({ name, email, passwordHash, role: "admin", active: true });
  console.log(`✓ created admin account (${email})`);
}

async function main() {
  console.log("Seeding FOCUS Street Kitchen database…\n");
  await seedMenu();
  await seedSettings();
  await seedAdmin();
  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
