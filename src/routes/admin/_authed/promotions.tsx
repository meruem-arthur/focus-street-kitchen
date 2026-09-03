import { createFileRoute, redirect } from "@tanstack/react-router";
import { PromotionsManager } from "@/components/admin/promotions-manager";

export const Route = createFileRoute("/admin/_authed/promotions")({
  head: () => ({ meta: [{ title: "Promotions — FOCUS Admin" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => {
    if (context.staff.role !== "admin") throw redirect({ to: "/admin" });
  },
  component: () => <PromotionsManager />,
});
