'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMyRestaurant } from '@/hooks/useMenu';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { RestaurantNav } from '@/components/ui/RestaurantNav';
import {
  useRestaurantStats,
  useBurndownChart,
  useRecentEvents,
} from '@/hooks/useAnalytics';

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data: restaurant, isLoading: restaurantLoading, isError: restaurantError } =
    useMyRestaurant();

  const restaurantId = restaurant?.id || '';

  const { data: statsData, loading: statsLoading, error: statsError } =
    useRestaurantStats(restaurantId, days);

  const { data: burndownData, loading: burndownLoading, error: burndownError } =
    useBurndownChart(restaurantId, 14);

  const { data: eventsData } = useRecentEvents(restaurantId, 10);

  const stats    = statsData?.restaurantStats;
  const burndown = burndownData?.burndownChart || [];
  const events   = eventsData?.recentEvents   || [];

  if (restaurantLoading) {
    return (
      <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-400">Yuklanmoqda...</p>
        </div>
      </AuthGuard>
    );
  }

  if (restaurantError || !restaurant) {
    return (
      <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
        <div className="min-h-screen flex items-center justify-center flex-col gap-3">
          <p className="text-red-500">Restoran topilmadi</p>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/restaurant/orders" className="text-gray-500 text-sm">← Buyurtmalar</Link>
            <h1 className="text-lg font-semibold">Analitika</h1>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value={7}>7 kun</option>
            <option value={14}>14 kun</option>
            <option value={30}>30 kun</option>
          </select>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Restoran nomi */}
        <div className="bg-orange-50 rounded-xl p-3 flex items-center gap-2">
          <span className="text-orange-500">🏪</span>
          <p className="text-sm font-medium text-orange-700">{restaurant.name}</p>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
            restaurant.status === 'OPEN'
              ? 'bg-green-100 text-green-700'
              : restaurant.status === 'BUSY'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {restaurant.status === 'OPEN' ? 'Ochiq' : restaurant.status === 'BUSY' ? 'Band' : 'Yopiq'}
          </span>
        </div>

        {/* Error holatlari */}
        {statsError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            Statistika yuklanmadi: {statsError.message}
          </div>
        )}
        {burndownError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            Grafik yuklanmadi: {burndownError.message}
          </div>
        )}

        {/* Stats grid */}
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-4 animate-pulse">
                <div className="h-3 bg-gray-100 rounded mb-2 w-3/4" />
                <div className="h-6 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Jami buyurtma',  value: stats.totalOrders,       icon: '📦' },
              { label: 'Bajarilgan',      value: stats.completedOrders,   icon: '✅' },
              { label: 'Bajarilish %',    value: `${Math.round(stats.completionRate)}%`, icon: '📊' },
              { label: 'Daromad',         value: `${stats.totalRevenue.toLocaleString()} so'm`, icon: '💰' },
              { label: "O'rt. vaqt",      value: `${Math.round(stats.avgDeliveryTime)} min`, icon: '⏱️' },
              { label: 'Bekor qilingan',  value: stats.cancelledOrders,   icon: '❌' },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{item.icon}</span>
                  <p className="text-xs text-gray-400">{item.label}</p>
                </div>
                <p className="text-xl font-bold text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Burndown chart */}
        {!burndownLoading && burndown.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm font-medium text-gray-700 mb-4">
              Kunlik buyurtmalar (so&apos;nggi {Math.min(7, burndown.length)} kun)
            </p>
            <div className="space-y-3">
              {burndown.slice(-7).map((point: {
                date: string;
                totalOrders: number;
                completedOrders: number;
                revenue: number;
              }) => {
                const pct =
                  point.totalOrders > 0
                    ? (point.completedOrders / point.totalOrders) * 100
                    : 0;
                return (
                  <div key={point.date}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-400">
                        {new Date(point.date).toLocaleDateString('uz-UZ', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-gray-600">
                        {point.completedOrders}/{point.totalOrders} ta
                      </p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-orange-400 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 text-right">
                      {point.revenue.toLocaleString()} so&apos;m
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent events */}
        {events.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">
              So&apos;nggi hodisalar
            </p>
            <div className="space-y-2">
              {events.map(
                (e: {
                  id: string;
                  orderId: string;
                  eventType: string;
                  totalAmount?: number;
                  deliveryTime?: number;
                  createdAt: string;
                }) => (
                  <div
                    key={e.id}
                    className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        #{e.orderId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {e.eventType.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      {e.totalAmount != null && (
                        <p className="text-xs font-medium text-gray-700">
                          {e.totalAmount.toLocaleString()} so&apos;m
                        </p>
                      )}
                      {e.deliveryTime != null && (
                        <p className="text-xs text-gray-400">{e.deliveryTime} min</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {new Date(e.createdAt).toLocaleTimeString('uz')}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </main>
      <RestaurantNav />
    </div>
    </AuthGuard>
  );
}
