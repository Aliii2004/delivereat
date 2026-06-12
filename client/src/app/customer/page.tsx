'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRestaurants } from '@/hooks/useMenu';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { CustomerNav } from '@/components/ui/CustomerNav';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  OPEN:   { label: 'Ochiq', color: 'text-green-600 bg-green-50'   },
  CLOSED: { label: 'Yopiq', color: 'text-gray-500 bg-gray-100'    },
  BUSY:   { label: 'Band',  color: 'text-yellow-600 bg-yellow-50' },
};

export default function CustomerPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useRestaurants(page);
  const restaurants = data?.restaurants || [];
  const pagination = data?.pagination as
    | { page: number; limit: number; total: number; pages: number }
    | undefined;

  // Client-side filter (search va status)
  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.address.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [restaurants, search, statusFilter]);

  return (
    <AuthGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-orange-500">🍽️ DeliverEat</h1>
              <Link href="/customer/orders" className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                📦 Buyurtmalar
              </Link>
            </div>

            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Restoran qidirish..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
              {[
                { value: 'ALL', label: 'Hammasi' },
                { value: 'OPEN', label: '🟢 Ochiq' },
                { value: 'BUSY', label: '🟡 Band' },
                { value: 'CLOSED', label: '⚫ Yopiq' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    statusFilter === opt.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-24" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">⚠️</p>
              <p className="text-red-500 mb-3">Ma&apos;lumot yuklanmadi</p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-orange-500 border border-orange-300 px-4 py-2 rounded-lg"
              >
                Qayta urinish
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-gray-600 font-medium">
                {search ? `"${search}" bo'yicha natija yo'q` : 'Restoranlar topilmadi'}
              </p>
              {search && (
                <button onClick={() => setSearch('')} className="text-sm text-orange-500 mt-2 underline">
                  Qidiruvni tozalash
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Result count */}
              {(search || statusFilter !== 'ALL') && (
                <p className="text-xs text-gray-400">{filtered.length} ta restoran topildi</p>
              )}

              {filtered.map((r) => {
                const s = STATUS_LABEL[r.status] || STATUS_LABEL.CLOSED;
                const isOpen = r.status === 'OPEN';
                return (
                  <Link
                    key={r.id}
                    href={`/customer/menu/${r.id}`}
                    className={`block bg-white rounded-xl shadow-sm hover:shadow-md transition p-4 ${
                      !isOpen ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Logo */}
                      <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                        {r.logo ? (
                          <Image src={r.logo} alt={r.name} width={64} height={64} className="object-cover w-full h-full" />
                        ) : (
                          '🍽️'
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.color}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{r.address}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs">
                            <span className="text-yellow-400">★</span>
                            <span className="text-gray-600 font-medium">{r.rating.toFixed(1)}</span>
                          </span>
                          {!isOpen && (
                            <span className="text-xs text-gray-400">Buyurtma qabul qilinmaydi</span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <span className="text-gray-300 text-lg flex-shrink-0">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {(pagination?.pages ?? 0) > 1 && !search && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
              >
                ← Oldingi
              </button>
              <span className="px-4 py-2 text-sm text-gray-500">
                {page} / {pagination?.pages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === pagination?.pages}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40"
              >
                Keyingi →
              </button>
            </div>
          )}
        </main>

        <CustomerNav />
      </div>
    </AuthGuard>
  );
}
