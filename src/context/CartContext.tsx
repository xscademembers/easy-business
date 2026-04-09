'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  /** Server stock limit when added; omit for legacy cart rows (no cap). */
  maxStock?: number;
  variant?: { size?: string; color?: string; material?: string };
}

export type CartStockResult =
  | { ok: true }
  | { ok: false; message: string };

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => CartStockResult;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => CartStockResult;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CartItem[];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        localStorage.removeItem('cart');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = (item: CartItem): CartStockResult => {
    const cap = item.maxStock;
    if (cap !== undefined && cap <= 0) {
      return { ok: false, message: 'Out of stock' };
    }

    const prev = itemsRef.current;
    const existing = prev.find((i) => i.productId === item.productId);
    const mergedMax =
      item.maxStock !== undefined ? item.maxStock : existing?.maxStock;
    const existingQty = existing?.quantity ?? 0;
    const addQty = item.quantity;
    const nextTotal = existing ? existingQty + addQty : addQty;

    if (mergedMax !== undefined && mergedMax < nextTotal) {
      return {
        ok: false,
        message:
          mergedMax === 0
            ? 'Out of stock'
            : `Out of stock. Only ${mergedMax} available.`,
      };
    }

    const next =
      existing
        ? prev.map((i) =>
            i.productId === item.productId
              ? {
                  ...i,
                  quantity: nextTotal,
                  ...(item.maxStock !== undefined
                    ? { maxStock: item.maxStock }
                    : {}),
                }
              : i
          )
        : [...prev, { ...item, maxStock: cap }];
    itemsRef.current = next;
    setItems(next);

    return { ok: true };
  };

  const removeItem = (productId: string) => {
    const next = itemsRef.current.filter((i) => i.productId !== productId);
    itemsRef.current = next;
    setItems(next);
  };

  const updateQuantity = (
    productId: string,
    quantity: number
  ): CartStockResult => {
    const prev = itemsRef.current;
    if (quantity <= 0) {
      const next = prev.filter((i) => i.productId !== productId);
      itemsRef.current = next;
      setItems(next);
      return { ok: true };
    }

    const line = prev.find((i) => i.productId === productId);
    if (!line) {
      return { ok: false, message: 'Item not in cart' };
    }

    const cap = line.maxStock;
    if (cap !== undefined && quantity > cap) {
      return {
        ok: false,
        message:
          cap === 0
            ? 'Out of stock'
            : `Out of stock. Only ${cap} available.`,
      };
    }

    const next = prev.map((i) =>
      i.productId === productId ? { ...i, quantity } : i
    );
    itemsRef.current = next;
    setItems(next);
    return { ok: true };
  };

  const clearCart = () => {
    itemsRef.current = [];
    setItems([]);
  };

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
