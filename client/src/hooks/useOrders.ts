import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Order, CartItem } from '@/types';

// ─── QUERY KEYS ────────────────────────────────────────────
// Markazlashtirilgan query key lar — invalidation uchun

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
};

// ─── HOOKS ─────────────────────────────────────────────────

export function useMyOrders(page = 1) {
  return useQuery({
    queryKey: [...orderKeys.lists(), { page }],
    queryFn: () =>
      api.get<{ orders: Order[]; pagination: unknown }>('/orders', {
        params: { page, limit: 20 },
      }).then((r) => r.data),
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(orderId!),
    queryFn: () =>
      api.get<{ order: Order }>(`/orders/${orderId}`).then((r) => r.data.order),
    enabled: !!orderId,
    refetchInterval: false, // Socket orqali yangilanadi — polling emas
  });
}

interface CreateOrderPayload {
  restaurantId: string;
  addressId: string;
  items: Pick<CartItem, 'menuItemId' | 'quantity' | 'note'>[];
  note?: string;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) =>
      api.post<{ order: Order }>('/orders', payload).then((r) => r.data.order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      api.patch<{ order: Order }>(`/orders/${orderId}/cancel`, { reason }).then((r) => r.data.order),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
