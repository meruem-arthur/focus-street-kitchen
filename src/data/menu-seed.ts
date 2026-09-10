// Source-of-truth menu content used to seed the Neon database (see src/db/seed.ts).
// Editing this file does NOT change the live site — it only affects what
// `bun run db:seed` inserts. Once seeded, edit menu items via the DB / admin
// tools instead, or re-run the seed against a fresh database.

export type SeedVariant = {
  label?: string; // optional — leave unset to just show the price as the choice
  price: number; // GHS, decimal
};

export type SeedItem = {
  name: string;
  desc?: string;
} & (
  | { price: number; variants?: undefined } // single price
  | { price?: undefined; variants: SeedVariant[] } // 2+ price options
);

export type SeedCategory = {
  slug: string;
  title: string;
  blurb: string;
  layout: "list" | "grid" | "triple";
  items: SeedItem[];
};

export const MENU_SEED: SeedCategory[] = [
  {
    slug: "special",
    title: "Special",
    blurb: "Signature plates, plated generously.",
    layout: "list",
    items: [
      {
        name: "Focus Special Rice",
        variants: [{ price: 70 }, { price: 100 }],
        desc: "Chicken, beef, gizzard, sausage, octopus, egg, veggies",
      },
      {
        name: "Seafood Fried Rice",
        variants: [{ price: 70 }, { price: 100 }],
        desc: "Octopus, fish, shrimps / prawns",
      },
      {
        name: "Loaded Fries",
        variants: [{ price: 70 }, { price: 100 }],
        desc: "Chicken gizzard, fries, sausage, meat, veggies, cheese",
      },
      { name: "Prawns Special Rice", variants: [{ price: 70 }, { price: 100 }] },
      { name: "Seafood Spaghetti", variants: [{ price: 70 }, { price: 100 }] },
      { name: "Seafood Noodles", variants: [{ price: 70 }, { price: 100 }] },
      {
        name: "Focus Special Noodles & Spaghetti",
        variants: [{ price: 70 }, { price: 100 }],
      },
    ],
  },
  {
    slug: "banku",
    title: "Build Your Banku & Okro",
    blurb: "Pick your base, protein and okro.",
    layout: "grid",
    items: [
      { name: "Banku", price: 5 },
      // NOTE: read as 10/15 off a blurry phone photo — double-check the real
      // numbers on the printed menu and adjust via Menu Management if off.
      { name: "Okro", variants: [{ price: 10 }, { price: 15 }] },
      { name: "Meat", price: 25 },
      { name: "Fish", price: 10 },
      { name: "Salmon", price: 10 },
      { name: "Beef", price: 5 },
      { name: "Goat", price: 5 },
    ],
  },
  {
    slug: "fast",
    title: "Fast Packs",
    blurb: "Fast, filling, fairly priced.",
    layout: "list",
    items: [
      // NOTE: these splits were read off a blurry phone photo — double-check
      // the real numbers on the printed menu and adjust via Menu Management.
      {
        name: "Egg And Sausage Rice",
        variants: [{ price: 35 }, { price: 50 }],
        desc: "Fried rice, egg, sausage",
      },
      {
        name: "Jollof With Chicken / Fish",
        variants: [{ price: 40 }, { price: 70 }],
        desc: "Smoky, properly seasoned",
      },
      { name: "Fried Rice With Chicken / Fish", variants: [{ price: 40 }, { price: 70 }] },
      {
        name: "French Fries With Chicken",
        variants: [{ price: 40 }, { price: 70 }],
        desc: "Loaded, golden, hot",
      },
      {
        name: "Fried Yam: Sausage",
        variants: [{ price: 35 }, { price: 60 }],
        desc: "Crisp yam, spiced sausage",
      },
      {
        name: "Fried Yam: Chicken",
        variants: [{ price: 40 }, { price: 70 }],
        desc: "Crisp yam, grilled chicken",
      },
    ],
  },
  {
    slug: "assorted",
    title: "Assorted",
    blurb: "A little of everything, mixed right.",
    layout: "list",
    items: [
      {
        name: "Assorted Fried Rice",
        variants: [{ price: 40 }, { price: 60 }],
        desc: "Meat, chicken, egg, sausage, veg",
      },
      {
        name: "Assorted Jollof Rice",
        variants: [{ price: 45 }, { price: 70 }],
        desc: "Meat, chicken, egg, sausage, veg",
      },
      {
        name: "Assorted Spaghetti",
        variants: [{ price: 35 }, { price: 50 }],
        desc: "Meat, chicken, egg, sausage, veg",
      },
      {
        name: "Assorted Noodles",
        variants: [{ price: 40 }, { price: 60 }],
        desc: "Meat, chicken, egg, sausage, veg",
      },
    ],
  },
  {
    slug: "pizza",
    title: "Pizza",
    blurb: "Thin crust, generous top.",
    layout: "list",
    items: [
      {
        name: "Focus Special Pizza",
        variants: [{ price: 90 }, { price: 150 }],
        desc: "Chicken, beef, sausage, octopus, shrimps, veg",
      },
      {
        name: "Seafood",
        variants: [{ price: 90 }, { price: 140 }],
        desc: "Octopus, shrimps, fish",
      },
      {
        name: "All Season",
        variants: [{ price: 75 }, { price: 120 }],
        desc: "Meat, sausage, chicken, vegetables",
      },
      { name: "Chicken", variants: [{ price: 70 }, { price: 110 }] },
      { name: "Beef", variants: [{ price: 70 }, { price: 110 }] },
      { name: "Vegetables", variants: [{ price: 60 }, { price: 90 }], desc: "Fresh, garden mix" },
      { name: "Margherita", variants: [{ price: 60 }, { price: 90 }] },
      { name: "Sausage", variants: [{ price: 60 }, { price: 90 }] },
    ],
  },
  {
    slug: "pizza-2-slices",
    title: "2 Slices Pizza",
    blurb: "A smaller portion, its own thing — not a size of the whole pizza above.",
    layout: "grid",
    items: [
      { name: "Sausage", price: 30 },
      { name: "Chicken", price: 35 },
      { name: "Beef", price: 35 },
      { name: "All Season", price: 40 },
      { name: "Seafood", price: 45 },
      { name: "Focus Special", price: 50 },
    ],
  },
  {
    slug: "shawarma",
    title: "Shawarma",
    blurb: "Slow-spun, spiced, sliced to order.",
    layout: "grid",
    items: [
      { name: "Combo", price: 60 },
      { name: "Meat", variants: [{ price: 55 }, { price: 60 }] },
      { name: "Chicken", variants: [{ price: 50 }, { price: 60 }] },
      { name: "Sausage", variants: [{ price: 40 }, { price: 60 }] },
    ],
  },
  {
    slug: "locals",
    title: "Locals",
    blurb: "Ghana classics, done right.",
    layout: "grid",
    items: [
      {
        name: "Banku Tilapia",
        variants: [
          { label: "Half", price: 40 },
          { label: "Full", price: 70 },
        ],
      },
      { name: "Banku Fish", price: 30, desc: "Grilled, with shito" },
    ],
  },
  {
    slug: "extras",
    title: "Extras",
    blurb: "Top up your plate.",
    layout: "triple",
    items: [
      { name: "Cheese", price: 20 },
      { name: "Chicken", variants: [{ price: 15 }, { price: 20 }] },
      { name: "Fish", variants: [{ price: 20 }, { price: 30 }] },
      { name: "Banku", price: 5 },
      { name: "Rice", price: 20 },
      { name: "Shito", price: 5 },
      { name: "Meat", price: 10 },
      { name: "Sausage", price: 5 },
      { name: "Egg", price: 10 },
    ],
  },
  {
    slug: "wraps",
    title: "Wraps",
    blurb: "Rolled tight, packed full.",
    layout: "grid",
    items: [
      { name: "Shawarma", price: 30 },
      { name: "Chicken", price: 30 },
      { name: "Meat", price: 30 },
      { name: "Sausage", price: 25 },
      { name: "Rice", price: 20 },
      { name: "Shito", price: 5 },
    ],
  },
  {
    slug: "addons",
    title: "Meat Add-Ons",
    blurb: "Extra protein, your call.",
    layout: "grid",
    items: [
      { name: "Sausage", price: 5 },
      { name: "Beef", price: 8 },
      { name: "Chicken", price: 8 },
      { name: "Spring Rolls", price: 15 },
    ],
  },
  {
    slug: "others",
    title: "Others",
    blurb: "Little extras, big crunch.",
    layout: "grid",
    items: [{ name: "Spring Rolls 4pcs", price: 15 }],
  },
];
