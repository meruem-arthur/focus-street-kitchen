import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAdminAccounts } from "@/functions/staff";
import { listPromotions } from "@/functions/promotions";
import { getMenu } from "@/functions/menu";

export const Route = createFileRoute("/super-admin/_authed/")({
  head: () => ({ meta: [{ title: "Overview — Super Admin" }, { name: "robots", content: "noindex" }] }),
  component: SuperAdminOverview,
});

function SuperAdminOverview() {
  const adminsQuery = useQuery({ queryKey: ["sa-admins"], queryFn: () => listAdminAccounts() });
  const promosQuery = useQuery({ queryKey: ["promotions-list"], queryFn: () => listPromotions() });
  const menuQuery = useQuery({ queryKey: ["admin-menu"], queryFn: () => getMenu() });

  const itemCount = (menuQuery.data ?? []).reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Platform Overview</h1>
        <p className="mt-0.5 text-xs text-ink/45">
          Technical/platform view only — order and financial data lives with the business Admin.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard label="Admin Accounts" value={adminsQuery.data?.length ?? "—"} />
        <StatCard
          label="Active Admins"
          value={adminsQuery.data?.filter((a) => a.active).length ?? "—"}
        />
        <StatCard label="Menu Items" value={itemCount} />
        <StatCard label="Categories" value={menuQuery.data?.length ?? "—"} />
        <StatCard label="Promotions" value={promosQuery.data?.length ?? "—"} />
        <StatCard
          label="Active Promotions"
          value={promosQuery.data?.filter((p) => p.active).length ?? "—"}
        />
      </div>

      <div className="rounded-2xl bg-amber/10 p-4 text-xs text-ink/60 ring-1 ring-black/5">
        As the platform owner, this account manages Admin accounts, the menu, categories, images,
        and promotions. Customer order details, sales, and revenue are intentionally not shown
        here — that's business data reserved for the Admin dashboard.
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center ring-1 ring-black/5">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-ink/50">{label}</p>
    </div>
  );
}
