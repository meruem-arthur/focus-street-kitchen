import { createServerFn } from "@tanstack/react-start";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { activityLog } from "@/db/schema";
import { requireStaff } from "./auth";

export const listActivity = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
  .handler(async ({ data }) => {
    // Only the business Admin sees who-did-what — this is normal staff
    // operational activity, which Super Admin is explicitly excluded from.
    await requireStaff({ role: "admin" });

    const rows = await db.query.activityLog.findMany({
      orderBy: desc(activityLog.createdAt),
      limit: data?.limit ?? 50,
    });

    return rows;
  });
