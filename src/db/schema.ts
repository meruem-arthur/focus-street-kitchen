import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export const staffRoleEnum = pgEnum("staff_role", ["super_admin", "admin", "staff"]);

export const orderTypeEnum = pgEnum("order_type", ["pickup", "delivery"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
]);

export const paymentProviderEnum = pgEnum("payment_provider", ["paystack", "cash"]);

// ─────────────────────────────────────────────────────────────
// Staff / Users
// ─────────────────────────────────────────────────────────────

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  // Email is required for super_admin/admin (used for password-reset flows).
  // Staff accounts log in by username instead and may not have an email.
  email: varchar("email", { length: 200 }).unique(),
  // Staff accounts log in by username. Admin/super_admin may also have one,
  // but they primarily authenticate with email.
  username: varchar("username", { length: 60 }).unique(),
  passwordHash: text("password_hash").notNull(),
  role: staffRoleEnum("role").notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  // Who created this account (Super Admin creates Admins, Admin creates Staff).
  // Null for the first bootstrapped account.
  createdByStaffId: integer("created_by_staff_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Password reset tokens (Admin / Super Admin self-service recovery)
// ─────────────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  // We only ever store a hash of the token, never the raw value.
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Activity log (who did what, for accountability across staff)
// ─────────────────────────────────────────────────────────────

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").references(() => staff.id, { onDelete: "set null" }),
  // Snapshotted so the log stays readable even if the account is later renamed/deleted.
  staffName: varchar("staff_name", { length: 120 }).notNull(),
  staffRole: staffRoleEnum("staff_role").notNull(),
  action: varchar("action", { length: 200 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }),
  entityId: varchar("entity_id", { length: 40 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Promotions
// ─────────────────────────────────────────────────────────────

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  // Short badge shown on the storefront, e.g. "Friday Game Day — 15% off"
  badgeText: varchar("badge_text", { length: 120 }),
  active: boolean("active").notNull().default(true),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  // stable slug used by the frontend, e.g. "special", "banku"
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  title: varchar("title", { length: 120 }).notNull(),
  blurb: text("blurb"),
  // display layout hint the existing frontend uses: list | grid | triple
  layout: varchar("layout", { length: 20 }).notNull().default("list"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Menu Items
// ─────────────────────────────────────────────────────────────

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  // stored in GHS as a decimal, e.g. 70.00
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  available: boolean("available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// App Settings (delivery fee etc — editable without a redeploy)
// ─────────────────────────────────────────────────────────────

export const settings = pgTable("settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  // human readable, derived from id after insert, e.g. FOC-1048
  orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
  // opaque, unguessable token used for public order-tracking links
  trackingToken: varchar("tracking_token", { length: 64 }).notNull().unique(),

  customerName: varchar("customer_name", { length: 160 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
  customerEmail: varchar("customer_email", { length: 200 }),

  orderType: orderTypeEnum("order_type").notNull(),
  deliveryAddress: text("delivery_address"),
  deliveryNotes: text("delivery_notes"),

  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),

  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  orderStatus: orderStatusEnum("order_status").notNull().default("pending"),
  paymentReference: varchar("payment_reference", { length: 120 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Order Items
// ─────────────────────────────────────────────────────────────

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").references(() => menuItems.id, {
    onDelete: "set null",
  }),
  // snapshotted at order time so historical orders stay correct
  // even if the menu item is later renamed, repriced, or deleted
  itemName: varchar("item_name", { length: 160 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  specialInstructions: text("special_instructions"),
});

// ─────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: paymentProviderEnum("provider").notNull().default("paystack"),
  reference: varchar("reference", { length: 120 }).notNull().unique(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("GHS"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  // raw Paystack payload for the latest event, kept for reconciliation/debugging
  rawData: text("raw_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Order Status History
// ─────────────────────────────────────────────────────────────

export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  previousStatus: orderStatusEnum("previous_status"),
  newStatus: orderStatusEnum("new_status").notNull(),
  changedByStaffId: integer("changed_by_staff_id").references(() => staff.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Relations (used for Drizzle's relational query API)
// ─────────────────────────────────────────────────────────────

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  payments: many(payments),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, { fields: [orderItems.menuItemId], references: [menuItems.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
  staff: one(staff, { fields: [orderStatusHistory.changedByStaffId], references: [staff.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  staff: one(staff, { fields: [passwordResetTokens.staffId], references: [staff.id] }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  staff: one(staff, { fields: [activityLog.staffId], references: [staff.id] }),
}));

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Staff = typeof staff.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type OrderStatusHistoryRow = typeof orderStatusHistory.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type ActivityLogRow = typeof activityLog.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;

export const STAFF_ROLES = ["super_admin", "admin", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ORDER_STATUS_FLOW = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
] as const;
