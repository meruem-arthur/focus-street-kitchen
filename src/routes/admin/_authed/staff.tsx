import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listStaffAccounts,
  createStaffAccount,
  updateStaffAccount,
  setStaffActive,
  resetStaffPassword,
  deleteStaffAccount,
} from "@/functions/staff";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/admin/_authed/staff")({
  head: () => ({
    meta: [{ title: "Staff — FOCUS Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: ({ context }) => {
    // Server-side authorization is the real guard (see requireStaff calls in
    // functions/staff.ts) — this is just so Staff never even see the screen.
    if (context.staff.role !== "admin") throw redirect({ to: "/admin" });
  },
  component: StaffManagementPage,
});

function StaffManagementPage() {
  const queryClient = useQueryClient();
  const staffQuery = useQuery({
    queryKey: ["admin-staff-list"],
    queryFn: () => listStaffAccounts(),
  });

  const [showAdd, setShowAdd] = React.useState(false);
  const [resetTarget, setResetTarget] = React.useState<{ id: number; name: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<number | null>(null);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["admin-staff-list"] });
  }

  async function toggleActive(id: number, active: boolean) {
    setError(null);
    setPendingId(id);
    try {
      await setStaffActive({ data: { id, active } });
      await refresh();
      toast.success(active ? "Staff member activated" : "Staff member deactivated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(id: number) {
    if (!confirm("Remove this staff account? They will no longer be able to sign in.")) return;
    setError(null);
    setPendingId(id);
    try {
      await deleteStaffAccount({ data: { id } });
      await refresh();
      toast.success("Staff account removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove account.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Staff Management</h1>
          <p className="mt-0.5 text-xs text-ink/45">
            Each staff member gets their own login so the system can tell who did what.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-glass shrink-0 rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper"
        >
          + Add staff
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {staffQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (staffQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-ink/40">No staff accounts yet — add your first one above.</p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {staffQuery.data!.map((s) => (
            <div key={s.id} className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-ink/50">Username: {s.username}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    s.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
                  }`}
                >
                  {s.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink/40">
                Created {new Date(s.createdAt).toLocaleDateString("en-GB")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => toggleActive(s.id, !s.active)}
                  disabled={pendingId === s.id}
                  className="btn-glass-light inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-ink/70 disabled:opacity-60"
                >
                  {pendingId === s.id && <Spinner className="size-3.5" />}
                  {s.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => setResetTarget({ id: s.id, name: s.name })}
                  className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-ink/70"
                >
                  Reset password
                </button>
                <button
                  onClick={() => handleRemove(s.id)}
                  disabled={pendingId === s.id}
                  className="btn-glass-light inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-red-700 disabled:opacity-60"
                >
                  {pendingId === s.id && <Spinner className="size-3.5" />}
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddStaffDialog
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function AddStaffDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createStaffAccount({ data: { name, username, password } });
      toast.success("Staff account created");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create staff account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
      >
        <h2 className="text-base font-semibold">Add staff member</h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="Username (e.g. kwame)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <PasswordInput
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Temporary password"
          className="rounded-2xl bg-card py-2.5 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-glass-light flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-glass flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting && <Spinner className="size-3.5" />}
            {submitting ? "Adding…" : "Add staff"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
  onDone,
}: {
  target: { id: number; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await resetStaffPassword({ data: { id: target.id, newPassword: password } });
      toast.success("Password reset");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
      >
        <h2 className="text-base font-semibold">Reset password for {target.name}</h2>
        <PasswordInput
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="rounded-2xl bg-card py-2.5 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-glass-light flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-glass flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting && <Spinner className="size-3.5" />}
            {submitting ? "Saving…" : "Reset password"}
          </button>
        </div>
      </form>
    </div>
  );
}
