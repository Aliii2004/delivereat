// Root layout — SERVER COMPONENT (use client yo'q)
// metadata export uchun server component bo'lishi shart

import type { Metadata } from 'next';
import { Providers } from '@/components/ui/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'DeliverEat — Ovqat yetkazib berish',
  description: "O'zbekistonda real-time ovqat yetkazib berish platformasi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
