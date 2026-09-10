import * as React from "react";

export type CartLine = {
  menuItemId: number;
  // Set when this line is a specific price option of the dish (e.g. the
  // GH₵100 Loaded Fries) rather than a simple single-price item. Two lines
  // for the same dish but different variants are kept as separate lines —
  // e.g. 2× GH₵70 Loaded Fries and 3× GH₵100 Loaded Fries at once.
  variantId?: number;
  // Display text for the chosen option, e.g. "GH₵100" or "Full" — already
  // resolved (falls back to the price) so the UI never has to guess.
  variantLabel?: string;
  name: string;
  price: number; // snapshot for display only — server re-checks the real price at checkout
  quantity: number;
  specialInstructions?: string;
};

type CartState = {
  lines: CartLine[];
};

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (menuItemId: number, quantity: number, variantId?: number) => void;
  removeItem: (menuItemId: number, variantId?: number) => void;
  setInstructions: (menuItemId: number, note: string, variantId?: number) => void;
  clear: () => void;
};

const STORAGE_KEY = "focus_cart_v1";

const CartContext = React.createContext<CartContextValue | null>(null);

function sameLine(line: CartLine, menuItemId: number, variantId?: number): boolean {
  return line.menuItemId === menuItemId && (line.variantId ?? null) === (variantId ?? null);
}

function loadInitial(): CartState {
  if (typeof window === "undefined") return { lines: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.lines)) return parsed;
    return { lines: [] };
  } catch {
    return { lines: [] };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CartState>(() => loadInitial());

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage can throw in private-browsing / storage-full edge cases —
      // the cart still works for the current session via React state.
    }
  }, [state]);

  const addItem = React.useCallback<CartContextValue["addItem"]>((item, quantity = 1) => {
    setState((prev) => {
      const existing = prev.lines.find((l) => sameLine(l, item.menuItemId, item.variantId));
      if (existing) {
        return {
          lines: prev.lines.map((l) =>
            sameLine(l, item.menuItemId, item.variantId)
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          ),
        };
      }
      return { lines: [...prev.lines, { ...item, quantity }] };
    });
  }, []);

  const updateQuantity = React.useCallback<CartContextValue["updateQuantity"]>(
    (menuItemId, quantity, variantId) => {
      setState((prev) => {
        if (quantity <= 0) {
          return { lines: prev.lines.filter((l) => !sameLine(l, menuItemId, variantId)) };
        }
        return {
          lines: prev.lines.map((l) =>
            sameLine(l, menuItemId, variantId) ? { ...l, quantity } : l,
          ),
        };
      });
    },
    [],
  );

  const removeItem = React.useCallback<CartContextValue["removeItem"]>((menuItemId, variantId) => {
    setState((prev) => ({
      lines: prev.lines.filter((l) => !sameLine(l, menuItemId, variantId)),
    }));
  }, []);

  const setInstructions = React.useCallback<CartContextValue["setInstructions"]>(
    (menuItemId, note, variantId) => {
      setState((prev) => ({
        lines: prev.lines.map((l) =>
          sameLine(l, menuItemId, variantId) ? { ...l, specialInstructions: note } : l,
        ),
      }));
    },
    [],
  );

  const clear = React.useCallback(() => setState({ lines: [] }), []);

  const itemCount = state.lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = state.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const value: CartContextValue = {
    lines: state.lines,
    itemCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    setInstructions,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
