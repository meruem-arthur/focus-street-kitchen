import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { getCurrentStaff, logoutStaff } from "@/server/auth";

export const Route = createFileRoute("/admin/_authed")({
  beforeLoad: async () => {
    const staff = await getCurrentStaff();
    if (!staff) throw redirect({ to: "/admin/login" });
    return { staff };
  },
  component: AuthedAdminLayout,
});

function AuthedAdminLayout() {
  const { staff } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  async function handleLogout() {
    await logoutStaff();
    router.invalidate();
    await navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/5 bg-paper/95 px-4 py-3 backdrop-blur-sm">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-[8px] bg-clay text-paper">
            <span className="text-sm font-semibold leading-none">F</span>
          </div>
          <span className="text-sm font-semibold">Staff Dashboard</span>
        </Link>
        <nav className="flex items-center gap-3 text-xs font-medium text-ink/60">
          <Link to="/admin" activeProps={{ className: "text-clay" }}>
            Dashboard
          </Link>
          <Link to="/admin/orders" activeProps={{ className: "text-clay" }}>
            Orders
          </Link>
          <Link to="/admin/menu" activeProps={{ className: "text-clay" }}>
            Menu
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink/50">{staff.name}</span>
          <button onClick={handleLogout} className="text-xs font-medium text-clay">
            Log out
          </button>
        </div>
      </header>
      <main className="px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
