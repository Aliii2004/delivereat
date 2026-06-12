import { create } from 'zustand';
import { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;

  addItem: (item: CartItem, restaurantId: string, restaurantName: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalAmount: () => number;
  totalItems: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  restaurantId: null,
  restaurantName: null,

  addItem: (item, restaurantId, restaurantName) => {
    const { items, restaurantId: currentRestaurantId } = get();

    // Boshqa restoran — savat tozalanadi
    if (currentRestaurantId && currentRestaurantId !== restaurantId) {
      set({
        items: [{ ...item, quantity: item.quantity || 1 }],
        restaurantId,
        restaurantName,
      });
      return;
    }

    const existing = items.find((i) => i.menuItemId === item.menuItemId);
    if (existing) {
      set({
        items: items.map((i) =>
          i.menuItemId === item.menuItemId
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        ),
      });
    } else {
      set({
        items: [...items, { ...item, quantity: item.quantity || 1 }],
        restaurantId,
        restaurantName,
      });
    }
  },

  removeItem: (menuItemId) => {
    const { items } = get();
    const filtered = items.filter((i) => i.menuItemId !== menuItemId);
    set({
      items: filtered,
      restaurantId: filtered.length === 0 ? null : get().restaurantId,
      restaurantName: filtered.length === 0 ? null : get().restaurantName,
    });
  },

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.menuItemId === menuItemId ? { ...i, quantity } : i
      ),
    });
  },

  clearCart: () => set({ items: [], restaurantId: null, restaurantName: null }),

  totalAmount: () =>
    get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  totalItems: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
