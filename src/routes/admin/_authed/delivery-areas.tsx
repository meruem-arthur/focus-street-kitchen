import { createFileRoute, redirect } from "@tanstack/react-router";
import { DeliveryZonesManager } from "@/components/admin/delivery-zones-manager";

export const Route = createFileRoute("/admin/_authed/delivery-areas")({
  head: () => ({
    meta: [{ title: "Delivery Areas — FOCUS Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: ({ context }) => {
    if (context.staff.role !== "admin") throw redirect({ to: "/admin" });
  },
  component: () => <DeliveryZonesManager />,
});
