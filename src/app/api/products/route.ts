import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';
import { getImageEmbeddingFromJpegBuffer } from '@/lib/services/openaiImageEmbedding';

const publicFields = 'name price image_url';

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

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find()
        .select(publicFields)
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
    const { name, price, imageBase64, image_url } = body as {
      name?: string;
      price?: number;
      imageBase64?: string;
      image_url?: string;
      embedding?: unknown;
    };

    if (body.embedding !== undefined) {
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

    const { image_url: resolvedUrl, jpegBuffer } = await resolveImageAndBuffer({
      imageBase64,
      image_url,
    });

    const embedding = await getImageEmbeddingFromJpegBuffer(jpegBuffer);

    const product = await Product.create({
      name: name.trim(),
      price,
      image_url: resolvedUrl,
      embedding,
    });

    const lean = await Product.findById(product._id).select(publicFields).lean();
    return NextResponse.json(lean, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/products error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
