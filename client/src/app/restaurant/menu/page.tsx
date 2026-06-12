'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { RestaurantNav } from '@/components/ui/RestaurantNav';
import { useMyRestaurant } from '@/hooks/useMenu';
import { MenuItem, Category } from '@/types';

interface MenuItemWithCategory extends MenuItem {
  category?: Category;
}

export default function RestaurantMenuPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: restaurant } = useMyRestaurant();

  const { data: menuData, isLoading } = useQuery({
    queryKey: ['my-menu-items'],
    queryFn: () => api.get<{ menuItems: MenuItemWithCategory[] }>('/menu/my-items').then((r) => r.data.menuItems),
    enabled: !!restaurant,
  });

  const { data: catData } = useQuery({
    queryKey: ['my-restaurant'],
    queryFn: () => api.get<{ restaurant: { categories: Category[] } }>('/menu/my-restaurant').then((r) => r.data.restaurant),
  });
  const categories: Category[] = catData?.categories || [];

  // Yangi taom formasi
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MenuItemWithCategory | null>(null);
  const [form, setForm] = useState({ name: '', price: '', description: '', preparationTime: '15', categoryId: '', isAvailable: true });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/menu/items', {
        ...data,
        price: Number(data.price),
        preparationTime: Number(data.preparationTime),
        categoryId: data.categoryId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-menu-items'] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof form> }) =>
      api.patch(`/menu/items/${id}`, {
        ...data,
        price: data.price ? Number(data.price) : undefined,
        preparationTime: data.preparationTime ? Number(data.preparationTime) : undefined,
        categoryId: data.categoryId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-menu-items'] });
      setEditItem(null);
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.patch(`/menu/items/${id}`, { isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-menu-items'] }),
  });

  const resetForm = () => setForm({ name: '', price: '', description: '', preparationTime: '15', categoryId: '', isAvailable: true });

  const openEdit = (item: MenuItemWithCategory) => {
    setEditItem(item);
    setForm({
      name: item.name,
      price: String(item.price),
      description: item.description || '',
      preparationTime: String(item.preparationTime),
      categoryId: item.category?.id || '',
      isAvailable: item.isAvailable,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.price) return;
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const grouped = (menuData || []).reduce<Record<string, MenuItemWithCategory[]>>((acc, item) => {
    const cat = item.category?.name || 'Kategoriyasiz';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AuthGuard allowedRoles={['RESTAURANT_OWNER']}>
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Menyu</h1>
              {restaurant && <p className="text-xs text-gray-400">{restaurant.name}</p>}
            </div>
            <button
              onClick={() => { resetForm(); setEditItem(null); setShowForm(true); }}
              className="bg-orange-500 text-white text-sm px-4 py-2 rounded-xl font-medium"
            >
              + Taom
            </button>
          </div>
        </header>

        {/* Yangi/Tahrirlash formasi */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-gray-900 mb-4">{editItem ? 'Taomni tahrirlash' : 'Yangi taom'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nomi *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Taom nomi" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Narxi (so&apos;m) *</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="35000" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tavsif</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} placeholder="Qisqacha tavsif..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tayyorlanish (daqiqa)</label>
                    <input type="number" value={form.preparationTime} onChange={(e) => setForm({ ...form, preparationTime: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Kategoriya</label>
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                      <option value="">Tanlang</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                {editItem && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} className="accent-orange-500 w-4 h-4" />
                    <span className="text-sm text-gray-700">Mavjud (buyurtma qabul qiladi)</span>
                  </label>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setShowForm(false); setEditItem(null); resetForm(); }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm rounded-xl">Bekor</button>
                <button onClick={handleSubmit} disabled={isPending || !form.name || !form.price}
                  className="flex-1 py-3 bg-orange-500 text-white text-sm font-medium rounded-xl disabled:opacity-50">
                  {isPending ? '...' : editItem ? 'Saqlash' : "Qo'shish"}
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-2xl mx-auto px-4 py-4">
          {/* Kategoriyalar */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-700">Kategoriyalar</p>
              <button
                onClick={async () => {
                  const name = prompt('Kategoriya nomi:');
                  if (!name?.trim()) return;
                  try {
                    await api.post('/menu/categories', { name: name.trim() });
                    queryClient.invalidateQueries({ queryKey: ['my-restaurant'] });
                  } catch { alert('Xato yuz berdi'); }
                }}
                className="text-xs text-orange-500 font-medium"
              >
                + Qo&apos;shish
              </button>
            </div>
            {categories.length === 0 ? (
              <p className="text-xs text-gray-400">Kategoriya yo&apos;q</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span key={c.id} className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full">{c.name}</span>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-20" />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🍽️</p>
              <p className="text-gray-600 font-medium">Menyu bo&apos;sh</p>
              <p className="text-sm text-gray-400 mt-1">Yuqoridagi tugma orqali taom qo&apos;shing</p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</h2>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className={`bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 ${!item.isAvailable ? 'opacity-60' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
                          {!item.isAvailable && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Yopiq</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-orange-500 mt-0.5">{item.price.toLocaleString()} so&apos;m</p>
                        <p className="text-xs text-gray-400">~{item.preparationTime} daqiqa</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${item.isAvailable ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {item.isAvailable ? 'Ochiq' : 'Yopiq'}
                        </button>
                        <button onClick={() => openEdit(item)} className="text-xs px-2.5 py-1.5 bg-orange-50 text-orange-600 rounded-lg font-medium">
                          Tahrir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </main>

        <RestaurantNav />
      </div>
    </AuthGuard>
  );
}
