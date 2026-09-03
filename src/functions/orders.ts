import { createServerFn } from "@tanstack/react-start";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/db/client";
import { menuItems, orders, orderItems, orderStatusHistory, ORDER_STATUS_FLOW } from "@/db/schema";
import { requireStaff } from "./auth";
import { getDeliveryFee } from "./settings";
import { logActivity } from "@/lib/activity-log";

// Orders are day-to-day business/financial data. Super Admin is
// intentionally excluded from every function below — only Admin and
// Staff (the operational roles) may see or touch order data.
const OPERATIONAL_ROLES = ["admin", "staff"] as const;

// ─────────────────────────────────────────────────────────────
// Create order (customer)
// ─────────────────────────────────────────────────────────────

const cartItemSchema = z.object({
  menuItemId: z.number(),
  quantity: z.number().int().min(1).max(50),
  specialInstructions: z.string().max(300).optional(),
});

const createOrderSchema = z.object({
  customerName: z.string().min(1).max(160),
  customerPhone: z.string().min(6).max(40),
  customerEmail: z.string().email().optional().or(z.literal("")),
  orderType: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().max(400).optional(),
  deliveryNotes: z.string().max(400).optional(),
  items: z.array(cartItemSchema).min(1),
});

function generateTrackingToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export const createOrder = createServerFn({ method: "POST" })
  .validator(createOrderSchema)
  .handler(async ({ data }) => {
    if (data.orderType === "delivery" && !data.deliveryAddress?.trim()) {
      throw new Error("Delivery address is required for delivery orders.");
    }

    // Re-fetch every item server-side. Never trust prices/names from the client.
    const ids = [...new Set(data.items.map((i) => i.menuItemId))];
    const dbItems = await db.query.menuItems.findMany({
      where: (fields, { inArray }) => inArray(fields.id, ids),
    });
    const byId = new Map(dbItems.map((i) => [i.id, i]));

    let subtotal = 0;
    const lineItems: {
      menuItemId: number;
      itemName: string;
      unitPrice: string;
      quantity: number;
      subtotal: string;
      specialInstructions: string | null;
    }[] = [];

    for (const cartLine of data.items) {
      const item = byId.get(cartLine.menuItemId);
      if (!item) {
        throw new Error(`Menu item ${cartLine.menuItemId} no longer exists.`);
      }
      if (!item.available) {
        throw new Error(`"${item.name}" is currently unavailable — please remove it from your cart.`);
      }
      const unitPrice = Number(item.price);
      const lineSubtotal = unitPrice * cartLine.quantity;
      subtotal += lineSubtotal;

      lineItems.push({
        menuItemId: item.id,
        itemName: item.name,
        unitPrice: unitPrice.toFixed(2),
        quantity: cartLine.quantity,
        subtotal: lineSubtotal.toFixed(2),
        specialInstructions: cartLine.specialInstructions ?? null,
      });
    }

    const deliveryFee = data.orderType === "delivery" ? await getDeliveryFee() : 0;
    const total = subtotal + deliveryFee;
    const trackingToken = generateTrackingToken();

    const [inserted] = await db
      .insert(orders)
      .values({
        // placeholder, replaced right after insert once we have the numeric id
        orderNumber: "PENDING",
        trackingToken,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        orderType: data.orderType,
        deliveryAddress: data.orderType === "delivery" ? data.deliveryAddress : null,
        deliveryNotes: data.deliveryNotes || null,
        subtotal: subtotal.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        total: total.toFixed(2),
        paymentStatus: "pending",
        orderStatus: "pending",
      })
      .returning({ id: orders.id });

    const orderNumber = `FOC-${1000 + inserted.id}`;
    await db.update(orders).set({ orderNumber }).where(eq(orders.id, inserted.id));

    await db.insert(orderItems).values(
      lineItems.map((li) => ({
        orderId: inserted.id,
        ...li,
      })),
    );

    await db.insert(orderStatusHistory).values({
      orderId: inserted.id,
      previousStatus: null,
      newStatus: "pending",
      changedByStaffId: null,
    });

    return {
      orderId: inserted.id,
      orderNumber,
      trackingToken,
      subtotal,
      deliveryFee,
      total,
    };
  });

// ─────────────────────────────────────────────────────────────
// Customer order tracking (public, via unguessable token — never by raw id)
// ─────────────────────────────────────────────────────────────

export const getOrderByToken = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(10) }))
  .handler(async ({ data }) => {
    const order = await db.query.orders.findFirst({
      where: eq(orders.trackingToken, data.token),
      with: { items: true },
    });
    if (!order) {
      throw new Error("Order not found.");
    }

    return {
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        name: i.itemName,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
    };
  });

// ─────────────────────────────────────────────────────────────
// Staff order management
// ─────────────────────────────────────────────────────────────

const listOrdersSchema = z.object({
  status: z
    .enum(["pending", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled"])
    .optional(),
  orderType: z.enum(["pickup", "delivery"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  fromDate: z.string().optional(), // ISO date
  toDate: z.string().optional(),
});

export const listOrders = createServerFn({ method: "GET" })
  .validator(listOrdersSchema)
  .handler(async ({ data }) => {
    await requireStaff({ role: OPERATIONAL_ROLES });

    const conditions = [];
    if (data.status) conditions.push(eq(orders.orderStatus, data.status));
    if (data.orderType) conditions.push(eq(orders.orderType, data.orderType));
    if (data.paymentStatus) conditions.push(eq(orders.paymentStatus, data.paymentStatus));
    if (data.fromDate) conditions.push(gte(orders.createdAt, new Date(data.fromDate)));
    if (data.toDate) conditions.push(lte(orders.createdAt, new Date(data.toDate)));

    const rows = await db.query.orders.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: desc(orders.createdAt),
      with: { items: true },
      limit: 200,
    });

    return rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      orderType: o.orderType,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      total: Number(o.total),
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      createdAt: o.createdAt,
    }));
  });

export const getOrderById = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await requireStaff({ role: OPERATIONAL_ROLES });

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, data.id),
      with: {
        items: true,
        statusHistory: { orderBy: desc(orderStatusHistory.createdAt) },
        payments: true,
      },
    });
    if (!order) throw new Error("Order not found.");
    return order;
  });

const updateStatusSchema = z.object({
  orderId: z.number(),
  newStatus: z.enum([
    "pending",
    "accepted",
    "preparing",
    "ready",
    "out_for_delivery",
    "completed",
    "cancelled",
  ]),
});

/** Cancellation is always allowed from a non-terminal state; otherwise only the next step forward. */
function isValidTransition(current: string, next: string): boolean {
  if (next === "cancelled") return current !== "completed" && current !== "cancelled";
  const currentIndex = ORDER_STATUS_FLOW.indexOf(current as (typeof ORDER_STATUS_FLOW)[number]);
  const nextIndex = ORDER_STATUS_FLOW.indexOf(next as (typeof ORDER_STATUS_FLOW)[number]);
  if (currentIndex === -1 || nextIndex === -1) return false;
  return nextIndex === currentIndex + 1;
}

export const updateOrderStatus = createServerFn({ method: "POST" })
  .validator(updateStatusSchema)
  .handler(async ({ data }) => {
    const account = await requireStaff({ role: OPERATIONAL_ROLES });

    const order = await db.query.orders.findFirst({ where: eq(orders.id, data.orderId) });
    if (!order) throw new Error("Order not found.");

    if (!isValidTransition(order.orderStatus, data.newStatus)) {
      throw new Error(`Cannot move an order from "${order.orderStatus}" to "${data.newStatus}".`);
    }

    await db
      .update(orders)
      .set({ orderStatus: data.newStatus, updatedAt: new Date() })
      .where(eq(orders.id, data.orderId));

    await db.insert(orderStatusHistory).values({
      orderId: data.orderId,
      previousStatus: order.orderStatus,
      newStatus: data.newStatus,
      changedByStaffId: account.id,
    });

    await logActivity({
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Marked order ${order.orderNumber} as "${data.newStatus}"`,
      entityType: "order",
      entityId: order.orderNumber,
    });

    return { success: true };
  });

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: OPERATIONAL_ROLES });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayOrders = await db.query.orders.findMany({
    where: gte(orders.createdAt, startOfToday),
  });

  const paidToday = todayOrders.filter((o) => o.paymentStatus === "paid");
  const todaySales = paidToday.reduce((sum, o) => sum + Number(o.total), 0);

  const stats = {
    todayOrders: todayOrders.length,
    pending: todayOrders.filter((o) => o.orderStatus === "pending").length,
    accepted: todayOrders.filter((o) => o.orderStatus === "accepted").length,
    preparing: todayOrders.filter((o) => o.orderStatus === "preparing").length,
    ready: todayOrders.filter((o) => o.orderStatus === "ready").length,
    outForDelivery: todayOrders.filter((o) => o.orderStatus === "out_for_delivery").length,
    completed: todayOrders.filter((o) => o.orderStatus === "completed").length,
    cancelled: todayOrders.filter((o) => o.orderStatus === "cancelled").length,
    todaySales,
    averageOrderValue: paidToday.length > 0 ? todaySales / paidToday.length : 0,
  };

  return stats;
});
