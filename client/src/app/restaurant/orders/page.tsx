'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/axios';
import { useMyRestaurant } from '@/hooks/useMenu';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { RestaurantNav } from '@/components/ui/RestaurantNav';
import { Order } from '@/types';

type NewOrderNotif = {
  orderId: string;
  totalAmount: number;
  itemsCount: number;
  customerNote?: string;
};

export default function RestaurantOrdersPage() {
  const {
    data: restaurant,
    isLoading: restaurantLoading,
    isError: restaurantError,
  } = useMyRestaurant();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Buyurtmalarni yuklash
  useEffect(() => {
    setLoading(true);
    api
      .get<{ orders: Order[] }>('/orders')
      .then((r) => setOrders(r.data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  // Yangi buyurtma handler
  const handleNewOrder = useCallback(async (notif: NewOrderNotif) => {
    try {
      const { data } = await api.get<{ order: Order }>(`/orders/${notif.orderId}`);
      setOrders((prev) => {
        if (prev.some((o) => o.id === notif.orderId)) return prev;
        return [data.order, ...prev];
      });
    } catch {
      /* ignore */
    }
  }, []);

  // Socket — faqat browser da, restaurant ma'lum bo'lganda
  useEffect(() => {
    if (!restaurant?.id || typeof window === 'undefined') return;

    // Dynamic import — SSR da crash bo'lmaydi
    const { getSocket, joinRestaurantRoom } = require('@/lib/socket');
    const socket = getSocket();
    if (!socket) return;

    joinRestaurantRoom(restaurant.id);
    socket.on('order:new', handleNewOrder);

    return () => {
      socket.off('order:new', handleNewOrder);
    };
  }, [restaurant?.id, handleNewOrder]);

  const patchOrder = async (
    orderId: string,
    endpoint: string,
    nextStatus: Order['status']
  ) => {
    setActionLoading(orderId);
    setActionError(null);
    try {
      await api.patch(`/orders/${orderId}/${endpoint}`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
    } catch {
      setActionError("Amal bajarilmadi. Qayta urinib ko'ring.");
    } finally {
      setActionLoading(null);
    }
  };

  const activeOrders = orders.filter(
    (o) => !['DELIVERED', 'CANCELLED'].includes(o.status)
  );

  if (restaurantLoading) {
    return (
      <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthGuard>
    );
  }

  if (restaurantError || !restaurant) {
    return (
      <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
            <p className="text-4xl mb-4">🏪</p>
            <h2 className="font-semibold text-gray-900 mb-2">Restoran topilmadi</h2>
            <p className="text-sm text-gray-500">Bu akkaunt uchun restoran profili mavjud emas.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Faol buyurtmalar</h1>
            <p className="text-xs text-gray-400">{restaurant.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-orange-500 text-white text-xs px-2.5 py-1 rounded-full font-medium">
              {activeOrders.length}
            </span>
            <Link
              href="/restaurant/analytics"
              className="text-xs text-orange-500 border border-orange-200 px-3 py-1 rounded-full hover:bg-orange-50 transition"
            >
              Analitika
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Action xatosi */}
        {actionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🍽️</p>
            <p className="text-gray-600 font-medium">Hozircha faol buyurtma yo&apos;q</p>
            <p className="text-xs text-gray-400 mt-2">
              Yangi buyurtma kelganda avtomatik ko&apos;rinadi
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm p-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleTimeString('uz-UZ', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-orange-500">
                      {order.totalAmount.toLocaleString()} so&apos;m
                    </span>
                    <p className="text-xs text-gray-400">
                      {order.items.reduce((s, i) => s + i.quantity, 0)} ta mahsulot
                    </p>
                  </div>
                </div>

                {/* Taomlar */}
                <div className="space-y-0.5 mb-3">
                  {order.items.map((item) => (
                    <p key={item.id} className="text-sm text-gray-600">
                      • {item.menuItem.name} × {item.quantity}
                    </p>
                  ))}
                </div>

                {/* Manzil */}
                <p className="text-xs text-gray-400 mb-1">
                  📍 {order.address?.street}, {order.address?.city}
                </p>

                {/* Izoh */}
                {order.note && (
                  <p className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 mb-3">
                    💬 {order.note}
                  </p>
                )}

                {/* Amallar */}
                <div className="flex gap-2 mt-3">
                  {order.status === 'CONFIRMED' && (
                    <button
                      onClick={() => patchOrder(order.id, 'accept', 'ACCEPTED')}
                      disabled={actionLoading === order.id}
                      className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
                    >
                      {actionLoading === order.id ? '⏳' : '✓ Qabul qilish'}
                    </button>
                  )}
                  {order.status === 'ACCEPTED' && (
                    <button
                      onClick={() => patchOrder(order.id, 'preparing', 'PREPARING')}
                      disabled={actionLoading === order.id}
                      className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
                    >
                      {actionLoading === order.id ? '⏳' : '👨‍🍳 Tayyorlanmoqda'}
                    </button>
                  )}
                  {order.status === 'PREPARING' && (
                    <button
                      onClick={() => patchOrder(order.id, 'ready', 'READY')}
                      disabled={actionLoading === order.id}
                      className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
                    >
                      {actionLoading === order.id ? '⏳' : '🔔 Tayyor'}
                    </button>
                  )}
                  {order.status === 'READY' && (
                    <div className="flex-1 py-2.5 text-center text-sm text-gray-500 bg-gray-100 rounded-lg">
                      🛵 Kuryer kutilmoqda...
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <RestaurantNav />
    </div>
    </AuthGuard>
  );
}
