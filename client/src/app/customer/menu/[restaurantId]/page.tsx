'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useRestaurant, useMenu } from '@/hooks/useMenu';
import { useCartStore } from '@/store/cartStore';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { MenuItem } from '@/types';

export default function RestaurantMenuPage() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params.restaurantId as string;
  
  const { data: restaurant, isLoading: restaurantLoading } = useRestaurant(restaurantId);
  const { data: menuItems, isLoading: menuLoading } = useMenu(restaurantId);
  const { items, addItem, totalItems } = useCartStore();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const isLoading = restaurantLoading || menuLoading;

  // Kategoriyalar
  const categories = menuItems
    ? Array.from(new Set(menuItems.map((m) => m.category?.name).filter(Boolean))) as string[]
    : [];

  // Filter by category
  const filteredItems = selectedCategory
    ? menuItems?.filter((m) => m.category?.name === selectedCategory)
    : menuItems;

  const handleAddToCart = (item: MenuItem) => {
    if (!restaurant) return;
    
    addItem(
      {
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        note: itemNotes[item.id] || undefined,
      },
      restaurantId,
      restaurant.name
    );
    
    // Clear note after adding
    setItemNotes((prev) => ({ ...prev, [item.id]: '' }));
  };

  const getItemQuantityInCart = (menuItemId: string) => {
    return items.find((i) => i.menuItemId === menuItemId)?.quantity || 0;
  };

  if (isLoading) {
    return (
      <AuthGuard allowedRoles={['CUSTOMER']}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm p-4">
            <div className="max-w-md mx-auto">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-32 mb-2" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-48" />
            </div>
          </header>
          <main className="max-w-md mx-auto px-4 py-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-32" />
            ))}
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (!restaurant || !menuItems) {
    return (
      <AuthGuard allowedRoles={['CUSTOMER']}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-3">Ma&apos;lumot yuklanmadi</p>
            <button onClick={() => router.back()} className="text-orange-500 underline text-sm">
              Orqaga
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-500 text-sm mb-2 hover:text-orange-500"
            >
              ← Orqaga
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                {restaurant.logo ? (
                  <Image src={restaurant.logo} alt={restaurant.name} width={48} height={48} />
                ) : (
                  '🍽️'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">{restaurant.name}</h1>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    {restaurant.rating.toFixed(1)}
                  </span>
                  <span>·</span>
                  <span className="truncate">{restaurant.address}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="bg-white border-b sticky top-[88px] z-10">
            <div className="max-w-md mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === null
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Hammasi
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <main className="max-w-md mx-auto px-4 py-4">
          {filteredItems && filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Bu kategoriyada taom yo&apos;q</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems?.map((item) => {
                const inCart = getItemQuantityInCart(item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition p-4"
                  >
                    <div className="flex gap-3">
                      {/* Image */}
                      <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            🍽️
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                            {item.name}
                          </h3>
                          {!item.isAvailable && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                              Mavjud emas
                            </span>
                          )}
                        </div>
                        
                        {item.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-orange-500 text-sm">
                            {item.price.toLocaleString()} so&apos;m
                          </p>
                          <span className="text-xs text-gray-400">
                            ~{item.preparationTime} min
                          </span>
                        </div>

                        {/* Note input (optional) */}
                        {item.isAvailable && (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={itemNotes[item.id] || ''}
                              onChange={(e) =>
                                setItemNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="Izoh (masalan: achchiqsiz)"
                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                            />
                          </div>
                        )}

                        {/* Add to cart button */}
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={!item.isAvailable}
                          className="w-full mt-2 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {inCart > 0 ? `Savatda ${inCart} ta` : 'Savatga qo\'shish'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Cart Footer */}
        {totalItems() > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-xl z-20">
            <div className="max-w-md mx-auto">
              <button
                onClick={() => router.push('/customer/checkout')}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl flex items-center justify-between px-6 transition"
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm">
                    {totalItems()}
                  </span>
                  Savatni ko&apos;rish
                </span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
