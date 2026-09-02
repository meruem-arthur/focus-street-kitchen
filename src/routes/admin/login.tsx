import * as React from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { loginStaff, getCurrentStaff } from "@/functions/auth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Staff Login — FOCUS Street Kitchen" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const current = await getCurrentStaff();
    if (current) throw redirect({ to: "/admin" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await loginStaff({ data: { email, password } });
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-[10px] bg-clay text-paper">
            <span className="text-base font-semibold leading-none">F</span>
          </div>
          <h1 className="mt-3 text-xl font-semibold">Staff Login</h1>
          <p className="mt-1 text-sm text-ink/50">FOCUS Street Kitchen</p>
        </div>

        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
          className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
        />
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
        />

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-clay px-5 py-3 text-sm font-medium text-paper disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
