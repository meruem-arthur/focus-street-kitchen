import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDeliveryZones,
  saveDeliveryZone,
  setDeliveryZoneActive,
  deleteDeliveryZone,
} from "@/functions/delivery-zones";
import type { DeliveryZone } from "@/db/schema";

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

export function DeliveryZonesManager() {
  const queryClient = useQueryClient();
  const zonesQuery = useQuery({
    queryKey: ["delivery-zones-list"],
    queryFn: () => listDeliveryZones(),
  });
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["delivery-zones-list"] });
  }

  async function toggleActive(zone: DeliveryZone) {
    setError(null);
    try {
      await setDeliveryZoneActive({ data: { id: zone.id, active: !zone.active } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that area.");
    }
  }

  async function handleDelete(zone: DeliveryZone) {
    if (!confirm(`Delete "${zone.name}"? Past orders keep showing this area and its price.`))
      return;
    setError(null);
    try {
      await deleteDeliveryZone({ data: { id: zone.id } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that area.");
    }
  }

  const zones = zonesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Delivery Areas</h1>
          <p className="mt-0.5 text-xs text-ink/45">
            Set a delivery fee per area instead of one flat fee — customers pick their area at
            checkout.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-glass shrink-0 rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper"
        >
          + New area
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {zonesQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : zones.length === 0 ? (
        <p className="text-sm text-ink/40">
          No delivery areas yet — add one (e.g. "Kojokrom", GH₵15) to get started.
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) =>
            editingId === zone.id ? (
              <EditZoneCard
                key={zone.id}
                zone={zone}
                onCancel={() => setEditingId(null)}
                onSaved={async () => {
                  setEditingId(null);
                  await refresh();
                }}
              />
            ) : (
              <div key={zone.id} className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{zone.name}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      zone.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
                    }`}
                  >
                    {zone.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-1 text-xl font-semibold text-clay">
                  {formatGHS(Number(zone.fee))}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => setEditingId(zone.id)}
                    className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-ink/70"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(zone)}
                    className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-ink/70"
                  >
                    {zone.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(zone)}
                    className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {showAdd && (
        <AddZoneDialog
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function AddZoneDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [fee, setFee] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedFee = Number(fee);
    if (Number.isNaN(parsedFee) || parsedFee < 0) {
      setError("Enter a valid, non-negative fee.");
      return;
    }
    setSubmitting(true);
    try {
      await saveDeliveryZone({ data: { name, fee: parsedFee } });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that area.");
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
        <h2 className="text-base font-semibold">New delivery area</h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Area name (e.g. Kojokrom)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 ring-1 ring-black/5">
          <span className="text-sm text-ink/50">GH₵</span>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="Delivery fee"
            className="w-full bg-transparent text-sm focus:outline-none"
          />
        </div>
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
            className="btn-glass flex-1 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditZoneCard({
  zone,
  onCancel,
  onSaved,
}: {
  zone: DeliveryZone;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(zone.name);
  const [fee, setFee] = React.useState(Number(zone.fee).toFixed(2));
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedFee = Number(fee);
    if (Number.isNaN(parsedFee) || parsedFee < 0) {
      setError("Enter a valid, non-negative fee.");
      return;
    }
    setSubmitting(true);
    try {
      await saveDeliveryZone({ data: { id: zone.id, name, fee: parsedFee } });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that area.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-black/5 ring-clay/40"
    >
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-black/5"
      />
      <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 ring-1 ring-black/5">
        <span className="text-sm text-ink/50">GH₵</span>
        <input
          required
          type="number"
          step="0.01"
          min="0"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2 pt-0.5 text-xs">
        <button
          type="button"
          onClick={onCancel}
          className="btn-glass-light flex-1 rounded-full px-3 py-1.5 font-medium text-ink/70"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="btn-glass flex-1 rounded-full bg-clay px-3 py-1.5 font-medium text-paper disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
