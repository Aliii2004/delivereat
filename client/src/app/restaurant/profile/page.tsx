'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useMyRestaurant } from '@/hooks/useMenu';
import { api } from '@/lib/axios';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { RestaurantNav } from '@/components/ui/RestaurantNav';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_OPTIONS = [
  { value: 'OPEN',   label: 'Ochiq',  color: 'bg-green-500'  },
  { value: 'BUSY',   label: 'Band',   color: 'bg-yellow-500' },
  { value: 'CLOSED', label: 'Yopiq',  color: 'bg-gray-400'   },
];

export default function RestaurantProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { data: restaurant, isLoading } = useMyRestaurant();
  const queryClient = useQueryClient();
  const [statusLoading, setStatusLoading] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    router.replace('/login');
  };

  const handleStatusChange = async (status: string) => {
    setStatusLoading(true);
    try {
      await api.patch('/menu/restaurant/status', { status });
      queryClient.invalidateQueries({ queryKey: ['my-restaurant'] });
    } catch {
      alert('Holat o\'zgartirishda xato');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-lg font-bold text-gray-900">Profil va sozlamalar</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Foydalanuvchi */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">🏪</div>
              <div>
                <p className="font-bold text-gray-900">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <p className="text-xs text-orange-500 font-medium">Restoran egasi</p>
              </div>
            </div>
          </div>

          {/* Restoran holati */}
          {isLoading ? (
            <div className="bg-white rounded-xl p-5 animate-pulse h-32" />
          ) : restaurant ? (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-1">{restaurant.name}</p>
              <p className="text-xs text-gray-400 mb-4">{restaurant.address}</p>

              <p className="text-xs font-semibold text-gray-500 mb-2">RESTORAN HOLATI</p>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = restaurant.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                      disabled={statusLoading}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                        isActive
                          ? `${opt.color} text-white shadow-sm`
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Jami buyurtmalar</span>
                  <span className="font-semibold">{restaurant.totalOrders}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Reyting</span>
                  <span className="font-semibold">★ {restaurant.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Chiqish */}
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-white border border-red-200 text-red-500 font-medium rounded-xl hover:bg-red-50 transition"
          >
            Chiqish
          </button>
        </main>

        <RestaurantNav />
      </div>
    </AuthGuard>
  );
}
