import { DeliveryZonesManager } from "@/components/admin/delivery-zones-manager";

/**
 * Formerly a single flat "delivery fee" box. Delivery pricing is now
 * per-area (see delivery-zones-manager), so this just re-exports that
 * shared manager under the name the Settings route already imports.
 */
export function PlatformSettings() {
  return <DeliveryZonesManager />;
}
