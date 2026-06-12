'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  // hydrated = Zustand store rehydrate bo'ldimi
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Zustand persist rehydration tugagandan keyin check qilamiz
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // Agar allaqachon rehydrate bo'lgan bo'lsa
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      const routes: Record<string, string> = {
        CUSTOMER: '/customer',
        RESTAURANT_OWNER: '/restaurant/orders',
        COURIER: '/courier',
      };
      router.replace(routes[user.role] || '/login');
    }
  }, [hydrated, isAuthenticated, user, allowedRoles, router]);

  // Rehydration kutilmoqda - spinner ko'rsat
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Auth yo'q yoki noto'g'ri role - redirect ketmoqda
  if (!isAuthenticated) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
