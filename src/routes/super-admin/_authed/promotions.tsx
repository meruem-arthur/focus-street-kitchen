import { createFileRoute } from "@tanstack/react-router";
import { PromotionsManager } from "@/components/admin/promotions-manager";

export const Route = createFileRoute("/super-admin/_authed/promotions")({
  head: () => ({ meta: [{ title: "Promotions — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <PromotionsManager />,
});
