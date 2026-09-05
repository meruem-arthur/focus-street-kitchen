import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  LayoutGrid,
  ClipboardList,
  BarChart3,
  UtensilsCrossed,
  BadgePercent,
  MapPin,
  Users,
  UserCircle,
  LogOut,
} from "lucide-react";
import { getCurrentStaff, logoutStaff } from "@/functions/auth";

export const Route = createFileRoute("/admin/_authed")({
  beforeLoad: async () => {
    const staff = await getCurrentStaff();
    if (!staff) throw redirect({ to: "/admin/login" });
    // Super Admin is a platform role, not a business-operations role — it
    // never sees orders/financials, so it belongs on the /super-admin side.
    if (staff.role === "super_admin") throw redirect({ to: "/super-admin" });
    return { staff };
  },
  component: AuthedAdminLayout,
});

function AuthedAdminLayout() {
  const { staff } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const isAdmin = staff.role === "admin";

  async function handleLogout() {
    await logoutStaff();
    router.invalidate();
    await navigate({ to: "/admin/login" });
  }

  const navItems = [
    { to: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
    { to: "/admin/orders", label: "Orders", icon: ClipboardList },
    ...(isAdmin
      ? [
          { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
          { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
          { to: "/admin/promotions", label: "Promotions", icon: BadgePercent },
          { to: "/admin/delivery-areas", label: "Delivery Areas", icon: MapPin },
          { to: "/admin/staff", label: "Staff", icon: Users },
        ]
      : []),
    { to: "/admin/account", label: "My Account", icon: UserCircle },
  ] as const;

  return (
    <div className="min-h-screen bg-paper text-ink lg:flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-black/5 lg:bg-card/40 lg:px-4 lg:py-6">
        <Link to="/admin" className="flex items-center gap-2.5 px-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-clay text-paper">
            <span className="text-sm font-semibold leading-none">F</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">FOCUS Street Kitchen</p>
            <p className="text-[11px] text-ink/45">
              {isAdmin ? "Admin Dashboard" : "Staff Dashboard"}
            </p>
          </div>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item && item.exact }}
              activeProps={{ className: "bg-clay/10 text-clay" }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <item.icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-black/5 px-2 pt-4">
          <p className="truncate text-xs font-medium text-ink/70">{staff.name}</p>
          <button
            onClick={handleLogout}
            className="btn-glass-light mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-clay"
          >
            <LogOut className="size-3.5" />
            Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 lg:flex-1">
        {/* MOBILE / TABLET HEADER */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-black/5 bg-paper/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <Link to="/admin" className="flex shrink-0 items-center gap-2">
            <div className="grid size-8 place-items-center rounded-[8px] bg-clay text-paper">
              <span className="text-sm font-semibold leading-none">F</span>
            </div>
            <span className="hidden text-sm font-semibold sm:inline">
              {isAdmin ? "Admin Dashboard" : "Staff Dashboard"}
            </span>
          </Link>
          <nav className="flex flex-1 items-center gap-3 overflow-x-auto text-xs font-medium text-ink/60">
            <Link to="/admin" activeProps={{ className: "text-clay" }}>
              Dashboard
            </Link>
            <Link to="/admin/orders" activeProps={{ className: "text-clay" }}>
              Orders
            </Link>
            {isAdmin && (
              <>
                <Link to="/admin/analytics" activeProps={{ className: "text-clay" }}>
                  Analytics
                </Link>
                <Link to="/admin/menu" activeProps={{ className: "text-clay" }}>
                  Menu
                </Link>
                <Link to="/admin/promotions" activeProps={{ className: "text-clay" }}>
                  Promotions
                </Link>
                <Link to="/admin/delivery-areas" activeProps={{ className: "text-clay" }}>
                  Delivery Areas
                </Link>
                <Link to="/admin/staff" activeProps={{ className: "text-clay" }}>
                  Staff
                </Link>
              </>
            )}
            <Link to="/admin/account" activeProps={{ className: "text-clay" }}>
              My Account
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-ink/50 sm:inline">{staff.name}</span>
            <button
              onClick={handleLogout}
              className="btn-glass-light rounded-full px-3 py-1.5 text-xs font-medium text-clay"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="px-4 py-5 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
