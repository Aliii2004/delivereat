'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/axios';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { CustomerNav } from '@/components/ui/CustomerNav';
import { Address } from '@/types';

export default function CustomerProfilePage() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();

  // Profil edit
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  // Manzillar
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newStreet, setNewStreet] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addrLoading, setAddrLoading] = useState(false);

  useEffect(() => {
    api.get<{ user: { addresses: Address[] } }>('/auth/me').then(({ data }) => {
      setAddresses(data.user.addresses || []);
    });
  }, []);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    router.replace('/login');
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/profile', { name, phone });
      updateUser({ name: data.user.name, phone: data.user.phone });
      setEditing(false);
    } catch {
      alert("Saqlashda xato.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newStreet.trim()) return;
    setAddrLoading(true);
    try {
      const { data } = await api.post<{ address: Address }>('/addresses', {
        label: newLabel || 'Manzil',
        street: newStreet,
        city: 'Toshkent',
        isDefault: addresses.length === 0,
      });
      setAddresses((prev) => [...prev, data.address]);
      setNewStreet('');
      setNewLabel('');
      setAddingAddress(false);
    } catch {
      alert("Manzil qo'shishda xato.");
    } finally {
      setAddrLoading(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Manzilni o\'chirishni tasdiqlaysizmi?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("O'chirishda xato.");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/addresses/${id}/default`);
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      );
    } catch {
      alert("Xato yuz berdi.");
    }
  };

  return (
    <AuthGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4">
            <h1 className="text-lg font-semibold text-gray-900">Profil</h1>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-4 space-y-4">
          {/* Foydalanuvchi ma'lumotlari */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Shaxsiy ma&apos;lumotlar</h2>
              {!editing && (
                <button
                  onClick={() => { setEditing(true); setName(user?.name || ''); setPhone(user?.phone || ''); }}
                  className="text-xs text-orange-500 font-medium"
                >
                  Tahrirlash
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ism</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Telefon</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998901234567"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg"
                  >
                    Bekor
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex-1 py-2 bg-orange-500 text-white text-sm rounded-lg disabled:opacity-50"
                  >
                    {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">
                    👤
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{user?.name}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                    {user?.phone && <p className="text-sm text-gray-500">{user.phone}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manzillar */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Manzillarim</h2>
              <button
                onClick={() => setAddingAddress(true)}
                className="text-xs text-orange-500 font-medium"
              >
                + Qo&apos;shish
              </button>
            </div>

            {addresses.length === 0 && !addingAddress && (
              <p className="text-sm text-gray-400 text-center py-4">Manzil qo&apos;shilmagan</p>
            )}

            <div className="space-y-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    addr.isDefault ? 'border-orange-200 bg-orange-50' : 'border-gray-100'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{addr.isDefault ? '📍' : '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{addr.label}</p>
                    <p className="text-xs text-gray-500">{addr.street}, {addr.city}</p>
                    {addr.isDefault && (
                      <span className="text-xs text-orange-500 font-medium">Default</span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!addr.isDefault && (
                      <button
                        onClick={() => handleSetDefault(addr.id)}
                        className="text-xs text-gray-400 hover:text-orange-500 px-1"
                        title="Default qilish"
                      >
                        ★
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-xs text-gray-400 hover:text-red-500 px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {addingAddress && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nom (masalan: Uy, Ish)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <input
                  value={newStreet}
                  onChange={(e) => setNewStreet(e.target.value)}
                  placeholder="Ko'cha, uy raqami"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingAddress(false)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg"
                  >
                    Bekor
                  </button>
                  <button
                    onClick={handleAddAddress}
                    disabled={addrLoading || !newStreet.trim()}
                    className="flex-1 py-2 bg-orange-500 text-white text-sm rounded-lg disabled:opacity-50"
                  >
                    {addrLoading ? '...' : 'Saqlash'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chiqish */}
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-white border border-red-200 text-red-500 font-medium rounded-xl hover:bg-red-50 transition"
          >
            Chiqish
          </button>
        </main>

        <CustomerNav />
      </div>
    </AuthGuard>
  );
}
