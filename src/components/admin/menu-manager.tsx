import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update availability.");
    }
  }

  async function savePrice(
    id: number,
    categoryId: number,
    name: string,
    price: number,
    available: boolean,
  ) {
    setListError(null);
    try {
      await saveMenuItem({ data: { id, categoryId, name, price, available } });
      await refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update the price.");
    }
  }

  async function saveImageUrl(
    id: number,
    categoryId: number,
    name: string,
    price: number,
    available: boolean,
    imageUrl: string,
  ) {
    setListError(null);
    try {
      await saveMenuItem({
        data: { id, categoryId, name, price, available, imageUrl: imageUrl.trim() || null },
      });
      await refresh();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not update the image.");
    }
  }

  async function handleFileSelect(
    item: { id: number; name: string; price: number; available: boolean },
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
      await saveImageUrl(item.id, categoryId, item.name, item.price, item.available, url);
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
            and photos.
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
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={item.price}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val) && val > 0 && val !== item.price) {
                          savePrice(item.id, cat.id, item.name, val, item.available);
                        }
                      }}
                      className="mt-1 w-24 rounded-lg bg-paper px-2 py-1 text-xs ring-1 ring-black/10"
                    />
                    <input
                      key={item.imageUrl ?? ""}
                      type="url"
                      placeholder="Image URL (https://…)"
                      defaultValue={item.imageUrl ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (item.imageUrl ?? "")) {
                          saveImageUrl(item.id, cat.id, item.name, item.price, item.available, val);
                        }
                      }}
                      className="mt-1 w-full rounded-lg bg-paper px-2 py-1 text-xs ring-1 ring-black/10"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <label
                        className={`inline-flex shrink-0 cursor-pointer items-center rounded-lg bg-paper px-2 py-1 text-[10px] font-medium text-ink/60 ring-1 ring-black/10 ${
                          uploadingId === item.id ? "opacity-50" : ""
                        }`}
                      >
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
            className="btn-glass flex-1 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Saving…" : editing ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
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
  const [price, setPrice] = React.useState(editing ? String(editing.price) : "");
  const [imageUrl, setImageUrl] = React.useState(editing?.imageUrl ?? "");
  const [available, setAvailable] = React.useState(editing?.available ?? true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim();
    const parsedPrice = Number(price);
    if (!finalName) {
      setError("Please enter a dish name.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("Please enter a valid price greater than 0.");
      return;
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
          price: parsedPrice,
          imageUrl: imageUrl.trim() || null,
          available,
        },
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this item.");
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
            className="btn-glass flex-1 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Saving…" : editing ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}
