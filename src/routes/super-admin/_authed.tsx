import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { LayoutGrid, ShieldCheck, UtensilsCrossed, BadgePercent, Settings } from "lucide-react";
import { getCurrentStaff, logoutStaff } from "@/functions/auth";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";

export const Route = createFileRoute("/super-admin/_authed")({
  beforeLoad: async () => {
    const staff = await getCurrentStaff();
    if (!staff) throw redirect({ to: "/admin/login" });
    // The Super Admin is a platform/technical role, deliberately walled off
    // from business orders and financials — Admin/Staff belong on /admin.
    if (staff.role !== "super_admin") throw redirect({ to: "/admin" });
    return { staff };
  },
  component: SuperAdminLayout,
});

const navItems: DashboardNavItem[] = [
  { to: "/super-admin", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/super-admin/admins", label: "Admin Accounts", icon: ShieldCheck },
  { to: "/super-admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/super-admin/promotions", label: "Promotions", icon: BadgePercent },
  { to: "/super-admin/settings", label: "Settings", icon: Settings },
];

function SuperAdminLayout() {
  const { staff } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  async function handleLogout() {
    await logoutStaff();
    router.invalidate();
    await navigate({ to: "/admin/login" });
  }

  return (
    <DashboardShell
      subtitle="Super Admin"
      homeTo="/super-admin"
      navItems={navItems}
      staffName={staff.name}
      onLogout={handleLogout}
    >
      <Outlet />
    </DashboardShell>
  );
}
