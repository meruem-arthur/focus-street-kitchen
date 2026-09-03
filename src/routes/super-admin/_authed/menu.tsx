import { createFileRoute } from "@tanstack/react-router";
import { MenuManager } from "@/components/admin/menu-manager";

export const Route = createFileRoute("/super-admin/_authed/menu")({
  head: () => ({ meta: [{ title: "Menu — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <MenuManager />,
});
