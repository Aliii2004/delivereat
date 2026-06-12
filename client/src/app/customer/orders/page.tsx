'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMyOrders, useCancelOrder } from '@/hooks/useOrders';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { CustomerNav } from '@/components/ui/CustomerNav';
import { Order } from '@/types';

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  CONFIRMED:  { label: 'Kutilmoqda',      color: 'text-blue-600 bg-blue-50'   },
  ACCEPTED:   { label: 'Qabul qilindi',   color: 'text-indigo-600 bg-indigo-50' },
  PREPARING:  { label: 'Tayyorlanmoqda',  color: 'text-yellow-600 bg-yellow-50' },
  READY:      { label: 'Tayyor',          color: 'text-orange-600 bg-orange-50' },
  ON_THE_WAY: { label: "Yo'lda",          color: 'text-purple-600 bg-purple-50' },
  DELIVERED:  { label: 'Yetkazildi',      color: 'text-green-600 bg-green-50'  },
  CANCELLED:  { label: 'Bekor qilindi',   color: 'text-red-500 bg-red-50'      },
};

const ACTIVE_STATUSES = ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY'];

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = useMyOrders(page);
  const { mutateAsync: cancelOrder, isPending: cancelling } = useCancelOrder();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const orders: Order[] = data?.orders || [];
  const pagination = data?.pagination as
    | { page: number; pages: number }
    | undefined;

  const handleCancel = async (orderId: string) => {
    if (!confirm('Buyurtmani bekor qilmoqchimisiz?')) return;
    setCancellingId(orderId);
    try {
      await cancelOrder({ orderId });
      await refetch();
    } catch {
      alert("Bekor qilishda xato. Qayta urinib ko'ring.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <AuthGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4">
            <h1 className="text-lg font-semibold text-gray-900">Buyurtmalarim</h1>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-32" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">📦</p>
              <p className="text-gray-600 font-medium">Buyurtmalar yo&apos;q</p>
              <p className="text-sm text-gray-400 mt-2">Restorandan buyurtma bering</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const si = STATUS_INFO[order.status] || STATUS_INFO.CONFIRMED;
                const isActive = ACTIVE_STATUSES.includes(order.status);
                const canCancel = ['CONFIRMED', 'ACCEPTED', 'PREPARING'].includes(order.status);

                return (
                  <div key={order.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">
                          {order.restaurant.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          #{order.id.slice(0, 8).toUpperCase()} ·{' '}
                          {new Date(order.createdAt).toLocaleDateString('uz-UZ')}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${si.color}`}>
                        {si.label}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      {order.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
                    </p>

                    <div className="flex justify-between items-center">
                      <p className="font-bold text-orange-500">
                        {order.totalAmount.toLocaleString()} so&apos;m
                      </p>
                      <div className="flex gap-2">
                        {isActive && (
                          <button
                            onClick={() => router.push(`/customer/track/${order.id}`)}
                            className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg font-medium"
                          >
                            Kuzatish
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling && cancellingId === order.id}
                            className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg font-medium disabled:opacity-50"
                          >
                            {cancellingId === order.id ? '...' : 'Bekor qilish'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(pagination?.pages ?? 0) > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40">← Oldingi</button>
              <span className="px-4 py-2 text-sm text-gray-500">{page} / {pagination?.pages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page === pagination?.pages} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40">Keyingi →</button>
            </div>
          )}
        </main>

        <CustomerNav />
      </div>
    </AuthGuard>
  );
}
