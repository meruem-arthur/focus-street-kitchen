// TEMPORARY diagnostic route — delete this file once the DATABASE_URL issue
// is resolved. It deliberately never throws: every failure is caught and
// returned as JSON so the real error is visible in the browser instead of
// buried in Vercel's log UI.
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export const Route = createFileRoute("/api/debug-db")({
  server: {
    handlers: {
      GET: async () => {
        const hasUrl = !!process.env.DATABASE_URL;
        const urlHost = process.env.DATABASE_URL
          ? (process.env.DATABASE_URL.match(/@([^/]+)\//)?.[1] ?? "could not parse host")
          : null;

        try {
          const result = await db.execute(sql`select 1 as ok`);
          return Response.json({
            success: true,
            hasUrl,
            urlHost,
            queryResult: result,
          });
        } catch (error) {
          return Response.json({
            success: false,
            hasUrl,
            urlHost,
            errorName: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          });
        }
      },
    },
  },
});
