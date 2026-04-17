import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { normalizeProductImage } from '@/lib/services/imageNormalize';
import {
  dHashAllRotations,
  dHashFromGrayscale9x8,
} from '@/lib/services/imageHash';
import { buildImageFingerprint } from '@/lib/services/openaiImageEmbedding';
import { PRODUCT_PUBLIC_FIELDS } from '@/lib/constants/productFields';
import {
  ensureUniqueProductCode,
  isValidProductCode,
} from '@/lib/utils/productCode';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

function normalizeSizes(
  category: string,
  sizes: unknown
): string[] | undefined {
  if (category !== 'clothing') return undefined;
  if (!Array.isArray(sizes)) return undefined;
  const cleaned = sizes
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const product = await Product.findById(id).select(publicSelect).lean();
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      price,
      quantity,
      quantityDelta,
      category,
      sizes,
      productCode: productCodeInput,
      imageBase64,
      image_url,
      embedding: _reject,
      ...rest
    } = body as {
      name?: string;
      description?: string;
      price?: number;
      quantity?: number;
      quantityDelta?: number;
      category?: string;
      sizes?: unknown;
      productCode?: string;
      imageBase64?: string;
      image_url?: string;
      embedding?: unknown;
    };

    if (_reject !== undefined) {
      return NextResponse.json(
        { error: 'embedding must be computed server-side' },
        { status: 400 }
      );
    }

    const allowedExtra = Object.keys(rest).filter(
      (k) => !['_id', '__v'].includes(k)
    );
    if (allowedExtra.length > 0) {
      return NextResponse.json(
        {
          error: `Unknown fields: ${allowedExtra.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      update.name = name.trim();
    }
    if (description !== undefined) {
      update.description =
        typeof description === 'string' ? description.trim() : '';
    }
    if (price !== undefined) {
      if (typeof price !== 'number' || Number.isNaN(price)) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      }
      update.price = price;
    }
    if (quantity !== undefined) {
      if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
        return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      }
      update.quantity = Math.max(0, Math.floor(quantity));
    }
    if (quantityDelta !== undefined) {
      if (typeof quantityDelta !== 'number' || Number.isNaN(quantityDelta)) {
        return NextResponse.json(
          { error: 'Invalid quantityDelta' },
          { status: 400 }
        );
      }
      const current = await Product.findById(id).select('quantity').lean();
      if (!current) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      const base =
        typeof current.quantity === 'number' ? current.quantity : 0;
      update.quantity = Math.max(0, base + Math.floor(quantityDelta));
    }
    if (category !== undefined) {
      if (typeof category !== 'string' || !category.trim()) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      const cat = category.trim();
      update.category = cat;
      if (cat !== 'clothing') {
        update.sizes = undefined;
      }
    }
    if (sizes !== undefined) {
      const cat =
        (update.category as string) ||
        (await Product.findById(id).select('category').lean())?.category ||
        'general';
      const catStr = typeof cat === 'string' ? cat : 'general';
      update.sizes = normalizeSizes(catStr, sizes);
    }

    if (productCodeInput !== undefined) {
      const raw =
        typeof productCodeInput === 'string' ? productCodeInput.trim() : '';
      if (raw && !isValidProductCode(raw)) {
        return NextResponse.json(
          { error: 'productCode must be 5–7 digits' },
          { status: 400 }
        );
      }
      if (raw) {
        const taken = await Product.findOne({
          productCode: raw,
          _id: { $ne: id },
        }).lean();
        if (taken) {
          return NextResponse.json(
            { error: 'productCode already in use' },
            { status: 400 }
          );
        }
        update.productCode = raw;
      }
    }

    let normalizedImage: Awaited<ReturnType<typeof normalizeProductImage>> | null =
      null;
    let newDisplayUrl: string | null = null;

    if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      normalizedImage = await normalizeProductImage(imageBase64);
      newDisplayUrl = normalizedImage.dataUrl;
    } else if (
      typeof image_url === 'string' &&
      /^https?:\/\//i.test(image_url.trim())
    ) {
      const url = image_url.trim();
      const res = await fetch(url);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Could not fetch image_url (${res.status})` },
          { status: 400 }
        );
      }
      const rawBuf = Buffer.from(await res.arrayBuffer());
      normalizedImage = await normalizeProductImage(rawBuf);
      newDisplayUrl = url;
    }

    if (normalizedImage) {
      // Recompute dHashes + single-pass vision fingerprint + attributes in
      // parallel so the stored record stays internally consistent on image
      // replacement, without inflating OpenAI fan-out.
      const canonicalHash = dHashFromGrayscale9x8(normalizedImage.grayHash);
      const [rotationHashes, fingerprint] = await Promise.all([
        dHashAllRotations(normalizedImage.buffer),
        buildImageFingerprint(normalizedImage.buffer),
      ]);
      update.imageHashes = Array.from(
        new Set([canonicalHash, ...rotationHashes])
      );
      update.attributes = fingerprint.attributes;
      update.embedding = fingerprint.embedding;
      update.image_url = newDisplayUrl;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const product = await Product.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .select(publicSelect)
      .lean();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.productCode) {
      const code = await ensureUniqueProductCode(Product, null);
      const withCode = await Product.findByIdAndUpdate(
        id,
        { productCode: code },
        { new: true, runValidators: true }
      )
        .select(publicSelect)
        .lean();
      return NextResponse.json(withCode);
    }

    return NextResponse.json(product);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
