import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getDeliveryFeeFn, setDeliveryFee } from "@/functions/settings";

export function PlatformSettings() {
  const feeQuery = useQuery({ queryKey: ["delivery-fee"], queryFn: () => getDeliveryFeeFn() });
  const [fee, setFee] = React.useState<string>("");
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (feeQuery.data) setFee(feeQuery.data.deliveryFee.toFixed(2));
  }, [feeQuery.data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = Number(fee);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a valid, non-negative amount.");
      return;
    }
    setSubmitting(true);
    try {
      await setDeliveryFee({ data: { fee: parsed } });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Platform Settings</h1>
        <p className="mt-0.5 text-xs text-ink/45">Website/platform-level configuration.</p>
      </div>

      <div className="max-w-sm rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold">Delivery Fee</h2>
        <form onSubmit={handleSave} className="flex items-center gap-2">
          <span className="text-sm text-ink/50">GH₵</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-28 rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-black/5"
          />
          <button
            type="submit"
            disabled={submitting}
            className="btn-glass rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        {saved && <p className="mt-2 text-xs text-sage">Saved.</p>}
      </div>
    </div>
  );
}
