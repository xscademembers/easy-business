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

async function resolveRawImageBuffer(body: {
  imageBase64?: string;
  image_url?: string;
}): Promise<{ displayUrl: string | null; rawBuffer: Buffer }> {
  const { imageBase64, image_url } = body;

  if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
    const base64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]!
      : imageBase64;
    return { displayUrl: null, rawBuffer: Buffer.from(base64, 'base64') };
  }

  if (typeof image_url === 'string' && /^https?:\/\//i.test(image_url.trim())) {
    const url = image_url.trim();
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not fetch image_url (${res.status})`);
    }
    return {
      displayUrl: url,
      rawBuffer: Buffer.from(await res.arrayBuffer()),
    };
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
    const desc = typeof description === 'string' ? description.trim() : '';
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

    const { displayUrl, rawBuffer } = await resolveRawImageBuffer({
      imageBase64,
      image_url,
    });
    const normalized = await normalizeProductImage(rawBuffer);

    // Hashes + vision fingerprint + product code in parallel. The fingerprint
    // is a single vision call + single embedding call — keeping the OpenAI
    // fan-out low is what lets uploads stay under ~3 s. Rotation-invariant
    // duplicate matching comes from the 4-rotation dHash set below.
    const canonicalHash = dHashFromGrayscale9x8(normalized.grayHash);
    const [rotationHashes, fingerprint, productCode] = await Promise.all([
      dHashAllRotations(normalized.buffer),
      buildImageFingerprint(normalized.buffer),
      ensureUniqueProductCode(Product, codePref),
    ]);

    const hashes = Array.from(new Set([canonicalHash, ...rotationHashes]));
    const storedImageUrl = displayUrl ?? normalized.dataUrl;

    const product = await Product.create({
      name: name.trim(),
      description: desc,
      price,
      quantity: qty,
      category: cat,
      sizes: normalizedSizes,
      productCode,
      image_url: storedImageUrl,
      imageHashes: hashes,
      attributes: fingerprint.attributes,
      embedding: fingerprint.embedding,
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
