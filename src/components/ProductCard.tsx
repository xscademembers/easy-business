import Link from 'next/link';
import { Package } from 'lucide-react';

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    price: number;
    image_url?: string;
    productCode?: string;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="card group overflow-hidden motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-xl motion-reduce:hover:translate-y-0 rounded-2xl !p-4 sm:!p-5">
      <Link href={`/product/${product._id}`}>
        <div
          className="aspect-square rounded-xl overflow-hidden mb-4"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={48} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3
            className="font-semibold text-base line-clamp-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {product.name}
          </h3>

          <div className="flex items-center justify-between pt-2">
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--accent)' }}
            >
              ${product.price.toFixed(2)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
