import Link from 'next/link';
import { Package } from 'lucide-react';

interface ProductCardProps {
  product: {
    _id: string;
    productId: string;
    name: string;
    price: number;
    stock: number;
    image?: string;
    category: string;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const inStock = product.stock > 0;

  return (
    <article className="card group hover:shadow-lg transition-all duration-200 overflow-hidden">
      <Link href={`/product/${product._id}`}>
        <div
          className="aspect-square rounded-xl overflow-hidden mb-4"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={48} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <span
            className="text-xs font-medium uppercase tracking-wider px-2 py-1 rounded-md"
            style={{
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent)',
            }}
          >
            {product.category}
          </span>

          <h3
            className="font-semibold text-base line-clamp-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {product.name}
          </h3>

          <p
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            ID: {product.productId}
          </p>

          <div className="flex items-center justify-between pt-2">
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--accent)' }}
            >
              ${product.price.toFixed(2)}
            </span>
            <span
              className="text-xs font-medium px-2 py-1 rounded-full"
              style={{
                backgroundColor: inStock
                  ? 'var(--success)'
                  : 'var(--danger)',
                color: '#fff',
              }}
            >
              {inStock ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
