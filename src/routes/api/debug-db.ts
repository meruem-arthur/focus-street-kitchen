// TEMPORARY diagnostic route — delete this file once the DATABASE_URL issue
// is resolved. It deliberately never throws: every failure is caught and
// returned as JSON so the real error is visible in the browser instead of
// buried in Vercel's log UI.
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { getMenu } from "@/functions/menu";
import { getActivePromotions } from "@/functions/promotions";

function serializeError(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  };
}

export const Route = createFileRoute("/api/debug-db")({
  server: {
    handlers: {
      GET: async () => {
        const hasUrl = !!process.env.DATABASE_URL;
        const urlHost = process.env.DATABASE_URL
          ? (process.env.DATABASE_URL.match(/@([^/]+)\//)?.[1] ?? "could not parse host")
          : null;

        const out: Record<string, unknown> = { hasUrl, urlHost };

        // 1. Raw connectivity check
        try {
          await db.execute(sql`select 1 as ok`);
          out.rawConnection = { success: true };
        } catch (error) {
          out.rawConnection = { success: false, ...serializeError(error) };
        }

        // 2. List actual tables present in the connected database
        try {
          const tables = await db.execute(
            sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
          );
          out.tables = tables.rows;
        } catch (error) {
          out.tables = { success: false, ...serializeError(error) };
        }

        // 3. The exact function the homepage loader calls
        try {
          const menu = await getMenu();
          out.getMenu = { success: true, categoryCount: menu.length };
        } catch (error) {
          out.getMenu = { success: false, ...serializeError(error) };
        }

        // 4. The other function the homepage loader calls
        try {
          const promos = await getActivePromotions();
          out.getActivePromotions = { success: true, count: promos.length };
        } catch (error) {
          out.getActivePromotions = { success: false, ...serializeError(error) };
        }

        return Response.json(out);
      },
    },
  },
});
