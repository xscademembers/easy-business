import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';
import { getImageEmbeddingFromJpegBuffer } from '@/lib/services/openaiImageEmbedding';
import { PRODUCT_PUBLIC_FIELDS } from '@/lib/constants/productFields';
import {
  ensureUniqueProductCode,
  isValidProductCode,
} from '@/lib/utils/productCode';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

async function resolveImageAndBuffer(body: {
  imageBase64?: string;
  image_url?: string;
}): Promise<{ image_url: string; jpegBuffer: Buffer }> {
  const { imageBase64, image_url } = body;

  if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
    const { buffer, dataUrl } = await compressImageForClip(imageBase64);
    return { image_url: dataUrl, jpegBuffer: buffer };
  }

  if (typeof image_url === 'string' && /^https?:\/\//i.test(image_url.trim())) {
    const url = image_url.trim();
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not fetch image_url (${res.status})`);
    }
    const raw = Buffer.from(await res.arrayBuffer());
    const { buffer, dataUrl } = await compressImageForClip(raw);
    return { image_url: url, jpegBuffer: buffer };
  }

  throw new Error('Provide imageBase64 or a http(s) image_url');
}

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

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find()
        .select(publicSelect)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(),
    ]);

    return NextResponse.json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      name,
      description,
      price,
      quantity,
      category,
      sizes,
      productCode: productCodeInput,
      imageBase64,
      image_url,
      embedding: _reject,
    } = body as {
      name?: string;
      description?: string;
      price?: number;
      quantity?: number;
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

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (price === undefined || typeof price !== 'number' || Number.isNaN(price)) {
      return NextResponse.json({ error: 'price is required' }, { status: 400 });
    }

    const cat =
      typeof category === 'string' && category.trim()
        ? category.trim()
        : 'general';
    const qty =
      typeof quantity === 'number' && !Number.isNaN(quantity)
        ? Math.max(0, Math.floor(quantity))
        : 0;
    const desc =
      typeof description === 'string' ? description.trim() : '';
    const normalizedSizes = normalizeSizes(cat, sizes);

    const codePref =
      typeof productCodeInput === 'string' && productCodeInput.trim()
        ? productCodeInput.trim()
        : null;
    if (codePref && !isValidProductCode(codePref)) {
      return NextResponse.json(
        { error: 'productCode must be 5–7 digits' },
        { status: 400 }
      );
    }

    const { image_url: resolvedUrl, jpegBuffer } = await resolveImageAndBuffer({
      imageBase64,
      image_url,
    });

    const embedding = await getImageEmbeddingFromJpegBuffer(jpegBuffer);
    const productCode = await ensureUniqueProductCode(Product, codePref);

    const product = await Product.create({
      name: name.trim(),
      description: desc,
      price,
      quantity: qty,
      category: cat,
      sizes: normalizedSizes,
      productCode,
      image_url: resolvedUrl,
      embedding,
    });

    const lean = await Product.findById(product._id).select(publicSelect).lean();
    return NextResponse.json(lean, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/products error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
