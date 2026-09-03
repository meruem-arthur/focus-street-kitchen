import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMenu } from "@/functions/menu";
import { saveMenuItem, setItemAvailability } from "@/functions/menu";

export const Route = createFileRoute("/admin/_authed/menu")({
  head: () => ({ meta: [{ title: "Menu — FOCUS Staff" }, { name: "robots", content: "noindex" }] }),
  component: MenuManagementPage,
});

function MenuManagementPage() {
  const queryClient = useQueryClient();
  const menuQuery = useQuery({ queryKey: ["admin-menu"], queryFn: () => getMenu() });

  async function toggleAvailable(id: number, available: boolean) {
    await setItemAvailability({ data: { id, available } });
    queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
  }

  async function savePrice(id: number, categoryId: number, name: string, price: number, available: boolean) {
    await saveMenuItem({ data: { id, categoryId, name, price, available } });
    queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
  }

  async function saveImageUrl(
    id: number,
    categoryId: number,
    name: string,
    price: number,
    available: boolean,
    imageUrl: string,
  ) {
    await saveMenuItem({
      data: { id, categoryId, name, price, available, imageUrl: imageUrl.trim() || null },
    });
    queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
  }

  if (menuQuery.isLoading || !menuQuery.data) {
    return <p className="text-sm text-ink/40">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Menu Management</h1>
      <p className="text-xs text-ink/45">
        Toggle availability instantly, or tap a price or image URL to edit it. Paste any public image
        link (from your phone's cloud backup, Cloudinary, imgur, etc.) into the image field to give an
        item its own photo. Adding brand-new categories/items isn't
        wired into this screen yet — use Drizzle Studio (<code>bun run db:studio</code>) or ask for that
        follow-up.
      </p>

      {menuQuery.data.map((cat) => (
        <div key={cat.id}>
          <h2 className="text-sm font-semibold text-ink/70">{cat.title}</h2>
          <div className="mt-2 space-y-2">
            {cat.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5">
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
                  <p className="truncate text-sm font-medium">{item.name}</p>
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
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(e) => toggleAvailable(item.id, e.target.checked)}
                  />
                  Available
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
