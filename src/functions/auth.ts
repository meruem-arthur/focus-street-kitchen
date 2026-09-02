import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { staff } from "@/db/schema";
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// ─────────────────────────────────────────────────────────────
// Login / logout
// ─────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginStaff = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const account = await db.query.staff.findFirst({ where: eq(staff.email, data.email) });

    // Constant-shape response either way — don't reveal whether the email exists.
    if (!account || !account.active) {
      throw new Error("Invalid email or password.");
    }

    const valid = await bcrypt.compare(data.password, account.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password.");
    }

    const token = createSessionToken({ staffId: account.id, role: account.role });
    setCookie(SESSION_COOKIE.name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE.maxAgeSeconds,
    });

    return { id: account.id, name: account.name, email: account.email, role: account.role };
  });

export const logoutStaff = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE.name, { path: "/" });
  return { success: true };
});

// ─────────────────────────────────────────────────────────────
// Current session
// ─────────────────────────────────────────────────────────────

export const getCurrentStaff = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE.name);
  const session = verifySessionToken(token);
  if (!session) return null;

  const account = await db.query.staff.findFirst({ where: eq(staff.id, session.staffId) });
  if (!account || !account.active) return null;

  return { id: account.id, name: account.name, email: account.email, role: account.role };
});

/**
 * Server-side guard for use inside other server functions / API routes.
 * Throws if there is no valid staff session. Pass `role: "admin"` to
 * additionally require the admin role (e.g. for menu management).
 */
export async function requireStaff(options?: { role?: "admin" }) {
  const token = getCookie(SESSION_COOKIE.name);
  const session = verifySessionToken(token);
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  if (options?.role === "admin" && session.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  const account = await db.query.staff.findFirst({ where: eq(staff.id, session.staffId) });
  if (!account || !account.active) {
    throw new Error("UNAUTHORIZED");
  }

  return account;
}
