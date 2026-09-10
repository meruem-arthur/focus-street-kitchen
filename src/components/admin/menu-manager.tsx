import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  getMenu,
  saveMenuItem,
  setItemAvailability,
  deleteMenuItem,
  saveCategory,
  deleteCategory,
  type PublicCategory,
  type PublicMenuItem,
} from "@/functions/menu";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "@/lib/cloudinary";

const LAYOUT_OPTIONS = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
  { value: "triple", label: "Triple" },
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);
}

// Carries an item's existing price options through a partial update (e.g.
// just changing the photo) so that update doesn't accidentally wipe them —
// saveMenuItem always replaces the full price/variants state it's given.
function variantsPayload(item: PublicMenuItem) {
  return item.variants.map((v) => ({ label: v.label, price: v.price }));
}

type CategoryDialogState = { mode: "add" } | { mode: "edit"; category: PublicCategory };

type ItemDialogState =
  { mode: "add"; categoryId: number } | { mode: "edit"; categoryId: number; item: PublicMenuItem };

export function MenuManager() {
  const queryClient = useQueryClient();
  const menuQuery = useQuery({ queryKey: ["admin-menu"], queryFn: () => getMenu() });
  const [uploadingId, setUploadingId] = React.useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = React.useState<Record<number, string>>({});
  const [listError, setListError] = React.useState<string | null>(null);

  const [categoryDialog, setCategoryDialog] = React.useState<CategoryDialogState | null>(null);
  const [itemDialog, setItemDialog] = React.useState<ItemDialogState | null>(null);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
  }

  async function toggleAvailable(id: number, available: boolean) {
    setListError(null);
    try {
      await setItemAvailability({ data: { id, available } });
      await refresh();
      toast.success(available ? "Marked available" : "Marked unavailable");
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update availability.");
    }
  }

  /** Quick inline price edit — only ever used for simple (non-variant) items. */
  async function savePrice(
    id: number,
    categoryId: number,
    name: string,
    price: number,
    available: boolean,
    imageUrl: string | null,
  ) {
    setListError(null);
    try {
      await saveMenuItem({ data: { id, categoryId, name, price, available, imageUrl } });
      await refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update the price.");
    }
  }

  async function saveImageUrl(item: PublicMenuItem, categoryId: number, imageUrl: string) {
    setListError(null);
    try {
      await saveMenuItem({
        data: {
          id: item.id,
          categoryId,
          name: item.name,
          available: item.available,
          imageUrl: imageUrl.trim() || null,
          // Pass whichever pricing shape the item currently uses straight
          // through unchanged — this call is only meant to touch the photo.
          ...(item.variants.length > 0
            ? { variants: variantsPayload(item) }
            : { price: item.price! }),
        },
      });
      await refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update the image.");
    }
  }

  async function handleFileSelect(
    item: PublicMenuItem,
    categoryId: number,
    file: File | undefined,
  ) {
    if (!file) return;
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setUploadingId(item.id);
    try {
      const url = await uploadImageToCloudinary(file);
      await saveImageUrl(item, categoryId, url);
      toast.success("Photo uploaded");
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : "Upload failed. Please try again.",
      }));
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDeleteItem(item: PublicMenuItem) {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    setListError(null);
    try {
      await deleteMenuItem({ data: { id: item.id } });
      await refresh();
      toast.success(`"${item.name}" deleted`);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not delete this item.");
    }
  }

  async function handleDeleteCategory(cat: PublicCategory) {
    const message =
      cat.items.length > 0
        ? `Delete "${cat.title}" and all ${cat.items.length} item(s) in it? This can't be undone.`
        : `Delete "${cat.title}"? This can't be undone.`;
    if (!confirm(message)) return;
    setListError(null);
    try {
      await deleteCategory({ data: { id: cat.id } });
      await refresh();
      toast.success(`"${cat.title}" deleted`);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not delete this category.");
    }
  }

  if (menuQuery.isLoading || !menuQuery.data) {
    return <p className="text-sm text-ink/40">Loading…</p>;
  }

  const cats = menuQuery.data;
  const categoryOptions = cats.map((c) => ({ id: c.id, title: c.title }));
  const nextSortOrder = cats.length ? Math.max(...cats.map((c) => c.sortOrder)) + 1 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Menu Management</h1>
          <p className="mt-0.5 text-xs text-ink/45">
            Add categories, add or remove dishes under them, toggle availability, and edit prices
            and photos. A dish can have one price, or several price options (e.g. GH₵70/100) that
            customers choose between.
          </p>
        </div>
        <button
          onClick={() => setCategoryDialog({ mode: "add" })}
          className="btn-glass inline-flex shrink-0 items-center gap-1.5 rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper"
        >
          <Plus className="size-3.5" />
          New category
        </button>
      </div>

      {listError && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{listError}</p>
      )}

      {cats.length === 0 ? (
        <p className="text-sm text-ink/40">
          No categories yet. Add one to start building the menu.
        </p>
      ) : (
        cats.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-ink/70">{cat.title}</h2>
                {cat.blurb && <p className="truncate text-xs text-ink/40">{cat.blurb}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setItemDialog({ mode: "add", categoryId: cat.id })}
                  className="btn-glass-light inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium text-ink/70"
                >
                  <Plus className="size-3" />
                  Add item
                </button>
                <button
                  onClick={() => setCategoryDialog({ mode: "edit", category: cat })}
                  aria-label={`Edit ${cat.title}`}
                  className="btn-glass-light inline-flex items-center rounded-full p-1.5 text-ink/60"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  aria-label={`Delete ${cat.title}`}
                  className="btn-glass-light inline-flex items-center rounded-full p-1.5 text-red-700"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {cat.items.length === 0 && (
                <p className="rounded-2xl bg-card p-3 text-xs text-ink/40 ring-1 ring-black/5">
                  No items in this category yet.
                </p>
              )}
              {cat.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
                    />
                  ) : (
                    <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-paper text-[9px] text-ink/35 ring-1 ring-black/10">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <button
                        onClick={() => setItemDialog({ mode: "edit", categoryId: cat.id, item })}
                        aria-label={`Edit ${item.name}`}
                        className="shrink-0 text-ink/35 hover:text-ink/60"
                      >
                        <Pencil className="size-3" />
                      </button>
                    </div>
                    {item.description && (
                      <p className="truncate text-[11px] text-ink/40">{item.description}</p>
                    )}
                    {item.price !== null ? (
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={item.price}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (!Number.isNaN(val) && val > 0 && val !== item.price) {
                            savePrice(
                              item.id,
                              cat.id,
                              item.name,
                              val,
                              item.available,
                              item.imageUrl,
                            );
                          }
                        }}
                        className="mt-1 w-24 rounded-lg bg-paper px-2 py-1 text-xs ring-1 ring-black/10"
                      />
                    ) : (
                      <button
                        onClick={() => setItemDialog({ mode: "edit", categoryId: cat.id, item })}
                        className="mt-1 inline-flex items-center gap-1 rounded-lg bg-paper px-2 py-1 text-[11px] font-medium text-clay ring-1 ring-black/10"
                      >
                        {item.variants.length} price options — edit to change
                      </button>
                    )}
                    <input
                      key={item.imageUrl ?? ""}
                      type="url"
                      placeholder="Image URL (https://…)"
                      defaultValue={item.imageUrl ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (item.imageUrl ?? "")) {
                          saveImageUrl(item, cat.id, val);
                        }
                      }}
                      className="mt-1 w-full rounded-lg bg-paper px-2 py-1 text-xs ring-1 ring-black/10"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <label
                        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-paper px-2 py-1 text-[10px] font-medium text-ink/60 ring-1 ring-black/10 ${
                          uploadingId === item.id ? "opacity-50" : ""
                        }`}
                      >
                        {uploadingId === item.id && <Spinner className="size-3" />}
                        {uploadingId === item.id ? "Uploading…" : "Upload from device"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingId === item.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            handleFileSelect(item, cat.id, file);
                            e.target.value = ""; // allow re-selecting the same file later
                          }}
                          className="hidden"
                        />
                      </label>
                      {!isCloudinaryConfigured() && (
                        <span className="text-[10px] text-ink/35">Upload not configured yet</span>
                      )}
                    </div>
                    {uploadErrors[item.id] && (
                      <p className="mt-1 text-[10px] text-red-600">{uploadErrors[item.id]}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={item.available}
                        onChange={(e) => toggleAvailable(item.id, e.target.checked)}
                      />
                      Available
                    </label>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      aria-label={`Delete ${item.name}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {categoryDialog && (
        <CategoryDialog
          state={categoryDialog}
          suggestedSortOrder={nextSortOrder}
          onClose={() => setCategoryDialog(null)}
          onSaved={async () => {
            setCategoryDialog(null);
            await refresh();
          }}
        />
      )}

      {itemDialog && (
        <ItemDialog
          state={itemDialog}
          categories={categoryOptions}
          onClose={() => setItemDialog(null)}
          onSaved={async () => {
            setItemDialog(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  state,
  suggestedSortOrder,
  onClose,
  onSaved,
}: {
  state: CategoryDialogState;
  suggestedSortOrder: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = state.mode === "edit" ? state.category : null;
  const [title, setTitle] = React.useState(editing?.title ?? "");
  const [slug, setSlug] = React.useState(editing?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(editing));
  const [blurb, setBlurb] = React.useState(editing?.blurb ?? "");
  const [layout, setLayout] = React.useState<string>(editing?.layout ?? "list");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalTitle = title.trim();
    if (!finalTitle) {
      setError("Please enter a category name.");
      return;
    }
    const finalSlug = slugify(slug || finalTitle);
    if (!finalSlug) {
      setError("Please enter a valid name or URL slug.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await saveCategory({
        data: {
          id: editing?.id,
          slug: finalSlug,
          title: finalTitle,
          blurb: blurb.trim() || null,
          layout: layout as "list" | "grid" | "triple",
          sortOrder: editing ? editing.sortOrder : suggestedSortOrder,
        },
      });
      toast.success(editing ? "Category updated" : "Category created");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this category.");
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
        <h2 className="text-base font-semibold">{editing ? "Edit category" : "New category"}</h2>
        <input
          required
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="Name (e.g. Banku & Okro)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="URL slug (e.g. banku-okro)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <textarea
          value={blurb ?? ""}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="Short description (optional)"
          rows={2}
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <div>
          <label className="mb-1 block text-[11px] font-medium text-ink/50">Display layout</label>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5"
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
            className="btn-glass flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting && <Spinner className="size-3.5" />}
            {submitting ? "Saving…" : editing ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

type VariantRow = { key: number; label: string; price: string };
let variantRowKeySeq = 0;
function newVariantRow(label = "", price = ""): VariantRow {
  variantRowKeySeq += 1;
  return { key: variantRowKeySeq, label, price };
}

function ItemDialog({
  state,
  categories,
  onClose,
  onSaved,
}: {
  state: ItemDialogState;
  categories: { id: number; title: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = state.mode === "edit" ? state.item : null;
  const [categoryId, setCategoryId] = React.useState<number>(state.categoryId);
  const [name, setName] = React.useState(editing?.name ?? "");
  const [description, setDescription] = React.useState(editing?.description ?? "");
  const [hasVariants, setHasVariants] = React.useState((editing?.variants.length ?? 0) > 0);
  const [price, setPrice] = React.useState(
    editing && editing.price !== null ? String(editing.price) : "",
  );
  const [variantRows, setVariantRows] = React.useState<VariantRow[]>(() =>
    editing && editing.variants.length > 0
      ? editing.variants.map((v) => newVariantRow(v.label ?? "", String(v.price)))
      : [newVariantRow(), newVariantRow()],
  );
  const [imageUrl, setImageUrl] = React.useState(editing?.imageUrl ?? "");
  const [available, setAvailable] = React.useState(editing?.available ?? true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function updateVariantRow(key: number, patch: Partial<VariantRow>) {
    setVariantRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) {
      setError("Please enter a dish name.");
      return;
    }

    let payload: { price?: number; variants?: { label?: string | null; price: number }[] };

    if (hasVariants) {
      const parsedVariants = variantRows
        .filter((r) => r.price.trim() !== "")
        .map((r) => ({ label: r.label.trim() || null, price: Number(r.price) }));
      if (parsedVariants.some((v) => !Number.isFinite(v.price) || v.price <= 0)) {
        setError("Each price option needs a valid price greater than 0.");
        return;
      }
      if (parsedVariants.length < 2) {
        setError("Add at least 2 price options (e.g. GH₵70 and GH₵100).");
        return;
      }
      payload = { variants: parsedVariants };
    } else {
      const parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        setError("Please enter a valid price greater than 0.");
        return;
      }
      payload = { price: parsedPrice };
    }

    setSubmitting(true);
    setError(null);
    try {
      await saveMenuItem({
        data: {
          id: editing?.id,
          categoryId,
          name: finalName,
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
          available,
          ...payload,
        },
      });
      toast.success(editing ? "Item updated" : "Item added");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center overflow-y-auto bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
      >
        <h2 className="text-base font-semibold">{editing ? "Edit item" : "New item"}</h2>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-ink/50">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dish name (e.g. Jollof Special)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />

        <label className="flex items-center gap-2 text-xs text-ink/70">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => setHasVariants(e.target.checked)}
          />
          This dish has multiple prices (e.g. GH₵70 or GH₵100 — customer picks one)
        </label>

        {hasVariants ? (
          <div className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-black/5">
            {variantRows.map((row, i) => (
              <div key={row.key} className="flex items-center gap-1.5">
                <input
                  value={row.label}
                  onChange={(e) => updateVariantRow(row.key, { label: e.target.value })}
                  placeholder={`Label ${i + 1} (optional, e.g. "Half")`}
                  className="min-w-0 flex-1 rounded-xl bg-paper px-3 py-2 text-xs ring-1 ring-black/10 placeholder:text-ink/35"
                />
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={row.price}
                  onChange={(e) => updateVariantRow(row.key, { price: e.target.value })}
                  placeholder="Price"
                  className="w-20 shrink-0 rounded-xl bg-paper px-3 py-2 text-xs ring-1 ring-black/10 placeholder:text-ink/35"
                />
                <button
                  type="button"
                  onClick={() => setVariantRows((rows) => rows.filter((r) => r.key !== row.key))}
                  disabled={variantRows.length <= 2}
                  aria-label="Remove price option"
                  className="shrink-0 text-ink/35 hover:text-red-700 disabled:opacity-30"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setVariantRows((rows) => [...rows, newVariantRow()])}
              className="text-xs font-medium text-clay"
            >
              + Add another price option
            </button>
            <p className="text-[10px] text-ink/40">
              Leave the label blank to just show the price itself as the choice — that's how most of
              FOCUS's menu already works. Only fill it in for a real printed name, like "Half" /
              "Full".
            </p>
          </div>
        ) : (
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (GHS)"
            className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
          />
        )}

        <input
          type="url"
          value={imageUrl ?? ""}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional, https://…)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Available
        </label>
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
            {submitting ? "Saving…" : editing ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}
