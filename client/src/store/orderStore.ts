import { create } from 'zustand';
import { OrderStatus, CourierLocation } from '@/types';

interface OrderState {
  activeOrderId: string | null;
  activeOrderStatus: OrderStatus | null;
  courierLocation: CourierLocation | null;

  setActiveOrder: (orderId: string, status: OrderStatus) => void;
  updateStatus: (status: OrderStatus) => void;
  updateCourierLocation: (location: CourierLocation) => void;
  clearActiveOrder: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  activeOrderId: null,
  activeOrderStatus: null,
  courierLocation: null,

  setActiveOrder: (activeOrderId, activeOrderStatus) =>
    set({ activeOrderId, activeOrderStatus, courierLocation: null }),

  updateStatus: (activeOrderStatus) => set({ activeOrderStatus }),

  updateCourierLocation: (courierLocation) => set({ courierLocation }),

  clearActiveOrder: () =>
    set({ activeOrderId: null, activeOrderStatus: null, courierLocation: null }),
}));
