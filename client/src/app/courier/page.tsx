'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/axios';
import { useOrderStore } from '@/store/orderStore';
import { useAuthStore } from '@/store/authStore';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { Order } from '@/types';

interface SurgeAlert { zone: string; message: string; }

export default function CourierPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { updateCourierLocation } = useOrderStore();
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [courierStatus, setCourierStatus] = useState<'AVAILABLE' | 'OFFLINE'>('OFFLINE');
  const [surgeAlert, setSurgeAlert] = useState<SurgeAlert | null>(null);
  const surgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Available orders (READY status, geo-filtered)
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  
  // Active orders (assigned to me - ON_THE_WAY) - plural!
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null); // GPS tracking uchun birinchisi

  // Load available orders - location ref ishlatamiz (re-render triggerlamaydi)
  const locationRef = useRef<{ lat: number; lng: number }>({ lat: 41.2995, lng: 69.2401 });

  // Get current location once on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        locationRef.current = { lat, lng }; // state emas ref — re-render triggerlamaydi
        setGeoError(null);
      },
      () => {
        setGeoError('GPS ishlamadi. Barcha buyurtmalar ko\'rsatilmoqda.');
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  // Load available orders - faqat courierStatus o'zgarganda
  useEffect(() => {
    if (courierStatus !== 'AVAILABLE') {
      setAvailableOrders([]);
      return;
    }

    const loadAvailable = async () => {
      setAvailableLoading(true);
      try {
        const loc = locationRef.current;
        const { data } = await api.get<{ orders: Order[] }>('/couriers/available-orders', {
          params: { lat: loc.lat, lng: loc.lng, radius: 50 }, // 50km radius — katta maydon
        });
        setAvailableOrders(data.orders || []);
      } catch (err) {
        console.error('[Courier] Load available orders failed:', err);
      } finally {
        setAvailableLoading(false);
      }
    };

    loadAvailable();
    const interval = setInterval(loadAvailable, 15000);
    return () => clearInterval(interval);
  }, [courierStatus]); // faqat courierStatus — location o'zgarganda qayta yuklamaymiz

  // Load active orders (assigned to me - ON_THE_WAY)
  useEffect(() => {
    const loadActiveOrders = async () => {
      try {
        const { data } = await api.get<{ orders: Order[] }>('/orders');
        const actives = (data.orders || []).filter((o) => o.status === 'ON_THE_WAY');
        setActiveOrders(actives);
        setActiveOrder(actives[0] || null); // GPS tracking uchun birinchisi
      } catch (err) {
        console.error('[Courier] Load active orders failed:', err);
      }
    };

    loadActiveOrders();
    const interval = setInterval(loadActiveOrders, 8000);
    return () => clearInterval(interval);
  }, []);

  // Socket.io surge alerts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSocket } = require('@/lib/socket');
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join:all-zones');
    const handleSurge = (d: SurgeAlert) => {
      setSurgeAlert(d);
      if (surgeTimerRef.current) clearTimeout(surgeTimerRef.current);
      surgeTimerRef.current = setTimeout(() => setSurgeAlert(null), 15000);
    };
    socket.on('surge:alert', handleSurge);
    return () => {
      socket.off('surge:alert', handleSurge);
      if (surgeTimerRef.current) clearTimeout(surgeTimerRef.current);
    };
  }, []);

  // GPS tracking when ON_THE_WAY
  const stopLocationTracking = useCallback(() => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  const startLocationTracking = useCallback((orderId: string) => {
    if (locationIntervalRef.current || typeof window === 'undefined' || !navigator.geolocation) return;
    
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoError(null);
          const { latitude: lat, longitude: lng } = pos.coords;
          api.patch('/couriers/location', { lat, lng, orderId }).catch(() => {});
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getSocket } = require('@/lib/socket');
          const s = getSocket();
          if (s) s.emit('courier:location', { lat, lng, orderId });
          updateCourierLocation({ lat, lng, updatedAt: new Date().toISOString() });
        },
        (err) => {
          console.error('[Courier] GPS error:', err);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };
    
    send();
    locationIntervalRef.current = setInterval(send, 5000);
  }, [updateCourierLocation]);

  useEffect(() => {
    if (activeOrder?.status === 'ON_THE_WAY') {
      startLocationTracking(activeOrder.id);
    } else {
      stopLocationTracking();
    }
    return stopLocationTracking;
  }, [activeOrder?.id, activeOrder?.status, startLocationTracking, stopLocationTracking]);

  const handleStatusChange = async (status: 'AVAILABLE' | 'OFFLINE') => {
    try {
      await api.patch('/couriers/status', { status });
      setCourierStatus(status);
    } catch (err) {
      console.error('[Courier] Status change failed:', err);
    }
  };

  const handlePickup = async (orderId: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await api.patch(`/orders/${orderId}/pickup`);
      // Reload
      const { data } = await api.get<{ orders: Order[] }>('/orders');
      const active = data.orders.find((o) => o.status === 'ON_THE_WAY');
      setActiveOrder(active || null);
      setAvailableOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      setActionError("Buyurtmani olishda xato. Boshqa kuryer oldi bo'lishi mumkin.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeliver = async (orderId: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await api.patch(`/orders/${orderId}/deliver`);
      setActiveOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (activeOrder?.id === orderId) {
        setActiveOrder(null);
        stopLocationTracking();
      }
    } catch (err) {
      setActionError("Yetkazib berishda xato.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    logout();
    router.replace('/login');
  };

  return (
    <AuthGuard allowedRoles={['COURIER']}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Kuryer paneli</h1>
              <p className="text-xs text-gray-400">{user?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('AVAILABLE')}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition-all ${
                  courierStatus === 'AVAILABLE' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'
                }`}
              >
                Faol
              </button>
              <button
                onClick={() => handleStatusChange('OFFLINE')}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition-all ${
                  courierStatus === 'OFFLINE' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Offline
              </button>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 ml-1">
                Chiqish
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-4 space-y-3">
          {/* Surge Alert */}
          {surgeAlert && (
            <div className="p-4 bg-orange-500 text-white rounded-xl flex items-start gap-3 shadow-lg">
              <span className="text-2xl">⚡</span>
              <div className="flex-1">
                <p className="font-bold text-sm">Surge Alert — {surgeAlert.zone}</p>
                <p className="text-xs mt-0.5 opacity-90">{surgeAlert.message}</p>
              </div>
              <button onClick={() => setSurgeAlert(null)} className="opacity-70 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {/* GPS xatosi */}
          {geoError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex gap-2">
              <span>📍</span>
              <span>{geoError}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {actionError}
            </div>
          )}

          {/* GPS aktiv */}
          {activeOrders.length > 0 && !geoError && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
              GPS yuborilmoqda · {activeOrders.length} ta buyurtma yo&apos;lda
            </div>
          )}

          {/* Aktiv buyurtmalar — ON_THE_WAY (barcha olganlar) */}
          {activeOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">
                  Yetkazilmoqda ({activeOrders.length} ta)
                </p>
              </div>
              {activeOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-sm p-5 space-y-3 border-l-4 border-purple-400">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-bold text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-sm text-gray-500">{order.restaurant.name}</p>
                    </div>
                    <span className="font-bold text-orange-500">{order.totalAmount.toLocaleString()} so&apos;m</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">📍 Yetkazish manzili</p>
                    <p className="text-sm font-medium text-gray-800">
                      {order.address?.street}, {order.address?.city}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    {order.items.map((item) => (
                      <p key={item.id} className="text-sm text-gray-600">
                        • {item.menuItem.name} × {item.quantity}
                      </p>
                    ))}
                  </div>
                  <button
                    onClick={() => handleDeliver(order.id)}
                    disabled={actionLoading}
                    className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl disabled:opacity-50 transition"
                  >
                    {actionLoading ? '⏳ Yuklanmoqda...' : '✅ Yetkazib berdim'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* AVAILABLE orders - har doim ko'rsatiladi (active orders bo'lsa ham) */}
          {courierStatus === 'AVAILABLE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Tayyor buyurtmalar
                </p>
                {availableLoading && (
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {availableLoading && availableOrders.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Buyurtmalar yuklanmoqda...</p>
                </div>
              ) : availableOrders.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-10 text-center">
                  <p className="text-5xl mb-4">🛵</p>
                  <p className="text-gray-700 font-semibold">Tayyor buyurtma yo&apos;q</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Restoran tayyorlashini kuting
                  </p>
                </div>
              ) : (
                availableOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-bold text-gray-900">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-500">{order.restaurant.name}</p>
                      </div>
                      <span className="font-bold text-orange-500">
                        {order.totalAmount.toLocaleString()} so&apos;m
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-1">📍 Manzil</p>
                      <p className="text-sm font-medium">
                        {order.address?.street}, {order.address?.city}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      {order.items.map((item) => (
                        <p key={item.id} className="text-sm text-gray-600">
                          • {item.menuItem.name} × {item.quantity}
                        </p>
                      ))}
                    </div>
                    <button
                      onClick={() => handlePickup(order.id)}
                      disabled={actionLoading}
                      className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl disabled:opacity-50 transition"
                    >
                      {actionLoading ? '⏳' : '📦 Buyurtmani oldim'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* OFFLINE state */}
          {courierStatus === 'OFFLINE' && !activeOrder && (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center mt-4">
              <p className="text-5xl mb-4">😴</p>
              <p className="text-gray-700 font-semibold">Offline rejim</p>
              <p className="text-sm text-gray-400 mt-2">
                Buyurtma olish uchun <strong>Faol</strong> tugmasini bosing
              </p>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
