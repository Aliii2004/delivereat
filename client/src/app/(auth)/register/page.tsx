'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { User, AuthTokens, UserRole } from '@/types';

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string; icon: string }[] = [
  { value: 'CUSTOMER',         label: 'Mijoz',         desc: 'Ovqat buyurtma berish',    icon: '🛒' },
  { value: 'RESTAURANT_OWNER', label: 'Restoran egasi', desc: 'Buyurtma va menyu boshqaruv', icon: '🏪' },
  { value: 'COURIER',          label: 'Kuryer',         desc: 'Ovqat yetkazib berish',    icon: '🛵' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CUSTOMER' as UserRole });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Parol kamida 6 ta belgi bo\'lishi kerak'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
        '/auth/register', form
      );
      const tokens: AuthTokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
      setUser(data.user, tokens);
      const routes: Record<string, string> = {
        CUSTOMER: '/customer',
        RESTAURANT_OWNER: '/restaurant/orders',
        COURIER: '/courier',
      };
      router.push(routes[data.user.role] || '/');
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err)
          ? (err.response?.data as { message?: string })?.message || "Ro'yxatdan o'tishda xato"
          : "Ro'yxatdan o'tishda xato"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-orange-500">DeliverEat</h1>
          <p className="text-sm text-gray-500 mt-1">Yangi hisob yaratish</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ism</label>
            <input
              type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              required autoComplete="name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="To'liq ismingiz"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              required autoComplete="email"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Parol</label>
            <input
              type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              required minLength={6} autoComplete="new-password"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Kamida 6 ta belgi"
            />
          </div>

          {/* Rol tanlash */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${
                    form.role === opt.value ? 'border-orange-300 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <input
                    type="radio" name="role" value={opt.value}
                    checked={form.role === opt.value}
                    onChange={() => setForm({ ...form, role: opt.value })}
                    className="accent-orange-500"
                  />
                  <span className="text-xl">{opt.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl disabled:opacity-50 transition"
          >
            {loading ? 'Yuklanmoqda...' : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Hisobingiz bormi?{' '}
          <Link href="/login" className="text-orange-500 font-medium hover:underline">Kirish</Link>
        </p>
      </div>
    </div>
  );
}
