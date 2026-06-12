'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useOrder } from '@/hooks/useOrders';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { Order } from '@/types';
import dynamic from 'next/dynamic';

// Leaflet faqat client-side ishlatiladi (SSR da crash)
const MapComponent = dynamic(() => import('@/components/ui/OrderMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 rounded-xl flex items-center justify-center">
      <p className="text-sm text-gray-400">Xarita yuklanmoqda...</p>
    </div>
  ),
});

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  CONFIRMED: { label: 'Kutilmoqda', color: 'text-blue-600 bg-blue-50', icon: '⏳' },
  ACCEPTED: { label: 'Qabul qilindi', color: 'text-indigo-600 bg-indigo-50', icon: '✅' },
  PREPARING: { label: 'Tayyorlanmoqda', color: 'text-yellow-600 bg-yellow-50', icon: '👨‍🍳' },
  READY: { label: 'Tayyor', color: 'text-orange-600 bg-orange-50', icon: '📦' },
  ON_THE_WAY: { label: "Yo'lda", color: 'text-purple-600 bg-purple-50', icon: '🛵' },
  DELIVERED: { label: 'Yetkazildi', color: 'text-green-600 bg-green-50', icon: '🎉' },
  CANCELLED: { label: 'Bekor qilindi', color: 'text-red-500 bg-red-50', icon: '❌' },
};

const STATUS_STEPS = ['CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED'];

export default function OrderTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  const { data: order, isLoading, refetch } = useOrder(orderId);
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Socket.io real-time updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSocket } = require('@/lib/socket');
    const socket = getSocket();
    if (!socket || !orderId) return;

    // Join order room
    socket.emit('join:order', orderId);
    console.log('[OrderTracking] Joined order room:', orderId);

    // Listen for status updates
    const handleStatusUpdate = (data: { orderId: string; status: string }) => {
      console.log('[OrderTracking] Status update:', data);
      if (data.orderId === orderId) {
        refetch(); // Refresh order data
      }
    };

    // Listen for courier location
    const handleCourierMoved = (data: { orderId: string; lat: number; lng: number }) => {
      console.log('[OrderTracking] Courier moved:', data);
      if (data.orderId === orderId) {
        setCourierLocation({ lat: data.lat, lng: data.lng });
      }
    };

    socket.on('order:status', handleStatusUpdate);
    socket.on('courier:moved', handleCourierMoved);

    return () => {
      socket.off('order:status', handleStatusUpdate);
      socket.off('courier:moved', handleCourierMoved);
    };
  }, [orderId, refetch]);

  const getETA = useCallback((o: Order) => {
    // Simple ETA calculation based on status
    if (o.status === 'DELIVERED' || o.status === 'CANCELLED') return null;
    if (o.status === 'ON_THE_WAY') return '10-15 daqiqa';
    if (o.status === 'READY') return '20-25 daqiqa';
    return '30-40 daqiqa';
  }, []);

  const getCurrentStepIndex = (status: string) => {
    return STATUS_STEPS.indexOf(status);
  };

  if (isLoading) {
    return (
      <AuthGuard allowedRoles={['CUSTOMER']}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthGuard>
    );
  }

  if (!order) {
    return (
      <AuthGuard allowedRoles={['CUSTOMER']}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-3">Buyurtma topilmadi</p>
            <button onClick={() => router.push('/customer/orders')} className="text-orange-500 underline text-sm">
              Buyurtmalar sahifasiga
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  const statusInfo = STATUS_INFO[order.status] || STATUS_INFO.CONFIRMED;
  const currentStep = getCurrentStepIndex(order.status);
  const eta = getETA(order);

  return (
    <AuthGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen bg-gray-50 pb-4">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4">
            <button
              onClick={() => router.push('/customer/orders')}
              className="flex items-center gap-1 text-gray-500 text-sm mb-2 hover:text-orange-500"
            >
              ← Buyurtmalar
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">Buyurtma #{order.id.slice(0, 8).toUpperCase()}</h1>
                <p className="text-xs text-gray-400">{order.restaurant.name}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.label}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-4 space-y-4">
          {/* ETA */}
          {eta && (
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Taxminiy yetkazish vaqti</p>
                  <p className="text-2xl font-bold">{eta}</p>
                </div>
                <div className="text-5xl">{statusInfo.icon}</div>
              </div>
            </div>
          )}

          {/* Map (if courier assigned and on the way) */}
          {order.status === 'ON_THE_WAY' && order.address && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <span>🗺️</span>
                  Kuryer joylashuvi
                </p>
              </div>
              <MapComponent
                restaurant={{
                  lat: order.address.latitude - 0.01, // Mock restaurant location
                  lng: order.address.longitude - 0.01,
                  name: order.restaurant.name,
                }}
                delivery={{
                  lat: order.address.latitude,
                  lng: order.address.longitude,
                  address: `${order.address.street}, ${order.address.city}`,
                }}
                courier={courierLocation}
              />
            </div>
          )}

          {/* Progress Steps */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-4">Buyurtma holati</p>
            <div className="space-y-3">
              {STATUS_STEPS.filter((s) => s !== 'CANCELLED').map((step, index) => {
                const si = STATUS_INFO[step];
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step} className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition ${
                        isCompleted
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? '✓' : si.icon}
                    </div>

                    {/* Label */}
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent ? 'text-orange-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                        }`}
                      >
                        {si.label}
                      </p>
                    </div>

                    {/* Live indicator */}
                    {isCurrent && (
                      <span className="flex items-center gap-1.5 text-xs text-orange-500 animate-pulse">
                        <span className="w-2 h-2 bg-orange-500 rounded-full" />
                        Hozir
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Buyurtma tarkibi</p>
            <div className="space-y-2 mb-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.menuItem.name} × {item.quantity}
                  </span>
                  <span className="text-gray-500">{(item.price * item.quantity).toLocaleString()} so&apos;m</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Taomlar</span>
                <span>{(order.totalAmount - order.deliveryFee).toLocaleString()} so&apos;m</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Yetkazish</span>
                <span>{order.deliveryFee.toLocaleString()} so&apos;m</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Jami</span>
                <span className="text-orange-500">{order.totalAmount.toLocaleString()} so&apos;m</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-2">Yetkazish manzili</p>
            <p className="text-sm text-gray-600">
              {order.address.street}, {order.address.city}
            </p>
            {order.note && (
              <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                <p className="text-xs font-medium text-orange-800 mb-1">Izoh:</p>
                <p className="text-xs text-orange-700">{order.note}</p>
              </div>
            )}
          </div>

          {/* Courier Info (if assigned) */}
          {order.courier && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-2">Kuryer</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                  🛵
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{order.courier.user.name}</p>
                  {order.courier.user.phone && (
                    <p className="text-xs text-gray-500">{order.courier.user.phone}</p>
                  )}
                </div>
                {order.courier.user.phone && (
                  <a
                    href={`tel:${order.courier.user.phone}`}
                    className="px-4 py-2 bg-green-500 text-white text-xs font-medium rounded-lg"
                  >
                    📞 Qo&apos;ng&apos;iroq
                  </a>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
