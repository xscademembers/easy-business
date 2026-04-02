'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CartProvider>
        <AuthProvider>{children}</AuthProvider>
      </CartProvider>
    </ThemeProvider>
  );
}
