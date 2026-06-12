'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useCreateOrder } from '@/hooks/useOrders';
import { useOrderStore } from '@/store/orderStore';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { api } from '@/lib/axios';

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  isDefault?: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, restaurantId, restaurantName, totalAmount, clearCart } = useCartStore();
  const { mutateAsync: createOrder, isPending } = useCreateOrder();
  const { setActiveOrder } = useOrderStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [creatingAddress, setCreatingAddress] = useState(false);
  const DELIVERY_FEE = 15000;

  // Load addresses
  useEffect(() => {
    let cancelled = false;
    
    const loadAddresses = async () => {
      try {
        const { data } = await api.get<Address[]>('/addresses');
        if (cancelled) return;
        
        if (data && data.length > 0) {
          setAddresses(data);
          setSelectedAddress((data.find((a) => a.isDefault) || data[0]).id);
        } else {
          // Hech address yo'q - avtomatik yaratamiz
          setCreatingAddress(true);
          const { data: newAddr } = await api.post<{ address: Address }>('/addresses', {
            label: 'Uy',
            street: 'Toshkent shahri',
            city: 'Toshkent',
            latitude: 41.2995,
            longitude: 69.2401,
            isDefault: true,
          });
          if (!cancelled) {
            setAddresses([newAddr.address]);
            setSelectedAddress(newAddr.address.id);
            setCreatingAddress(false);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[Checkout] Address load failed:', err);
        setError("Manzil yuklanmadi. Profilingizga o'ting va manzil qo'shing.");
      }
    };
    
    loadAddresses();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (items.length === 0) router.replace('/customer');
  }, [items.length, router]);

  const handleOrder = async () => {
    if (!restaurantId || !selectedAddress) {
      setError('Manzil tanlang');
      return;
    }
    setError('');
    
    console.log('[Checkout] Creating order:', {
      restaurantId,
      addressId: selectedAddress,
      items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, note: i.note })),
      note,
    });
    
    try {
      const order = await createOrder({
        restaurantId,
        addressId: selectedAddress,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          note: i.note,
        })),
        note: note || undefined,
      });
      
      console.log('[Checkout] Order created:', order);
      setActiveOrder(order.id, order.status);
      clearCart();
      router.push(`/customer/track/${order.id}`);
    } catch (err) {
      console.error('[Checkout] Order creation failed:', err);
      const errorMsg = (err as any)?.response?.data?.message || "Buyurtmada xato. Qayta urinib ko'ring.";
      setError(errorMsg);
    }
  };

  if (items.length === 0) return null;

  return (
    <AuthGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen bg-gray-50 pb-28">
        <header className="bg-white shadow-sm">
          <div className="max-w-md mx-auto px-4 py-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-500 text-sm mb-1 hover:text-orange-500"
            >
              ← Orqaga
            </button>
            <h1 className="text-lg font-bold text-gray-900">Buyurtmani tasdiqlash</h1>
            {restaurantName && <p className="text-xs text-gray-400">{restaurantName}</p>}
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-4 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Buyurtma tarkibi */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Buyurtma</p>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="text-gray-500">
                    {(item.price * item.quantity).toLocaleString()} so&apos;m
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t mt-3 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Taomlar</span>
                <span>{totalAmount().toLocaleString()} so&apos;m</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Yetkazish</span>
                <span>{DELIVERY_FEE.toLocaleString()} so&apos;m</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Jami</span>
                <span className="text-orange-500">
                  {(totalAmount() + DELIVERY_FEE).toLocaleString()} so&apos;m
                </span>
              </div>
            </div>
          </div>

          {/* Manzil */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-bold text-gray-700">Yetkazish manzili</p>
              <button
                onClick={() => router.push('/customer/profile')}
                className="text-xs text-orange-500"
              >
                + Manzil qo&apos;shish
              </button>
            </div>
            {addresses.length === 0 ? (
              <div className="text-center py-4">
                {creatingAddress ? (
                  <>
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Manzil yaratilmoqda...</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400 mb-2">Manzil topilmadi</p>
                    <button
                      onClick={() => router.push('/customer/profile')}
                      className="text-sm text-orange-500 underline"
                    >
                      Manzil qo&apos;shish
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 cursor-pointer py-2.5 px-3 rounded-xl border transition-colors ${
                      selectedAddress === a.id
                        ? 'border-orange-300 bg-orange-50'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={a.id}
                      checked={selectedAddress === a.id}
                      onChange={() => setSelectedAddress(a.id)}
                      className="accent-orange-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.label}</p>
                      <p className="text-xs text-gray-400">
                        {a.street}, {a.city}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Izoh */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm font-bold text-gray-700 mb-2">Izoh (ixtiyoriy)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="4-qavat, 12-xona, qo'ng'iroq qilmang..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{note.length}/300</p>
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-xl">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleOrder}
              disabled={isPending || !selectedAddress || creatingAddress}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl disabled:opacity-50 transition"
            >
              {isPending
                ? 'Yuborilmoqda...'
                : creatingAddress
                ? 'Manzil tayyorlanmoqda...'
                : `Buyurtma berish — ${(totalAmount() + DELIVERY_FEE).toLocaleString()} so'm`}
            </button>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
