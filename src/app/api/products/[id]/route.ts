import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';
import { getClipEmbeddingFromJpegBuffer } from '@/lib/services/clipApi';

const publicFields = 'name price image_url';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const product = await Product.findById(id).select(publicFields).lean();
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
      price,
      imageBase64,
      image_url,
      embedding: _reject,
      ...rest
    } = body as {
      name?: string;
      price?: number;
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

    if (Object.keys(rest).length > 0) {
      return NextResponse.json(
        { error: 'Only name, price, imageBase64, and image_url can be updated' },
        { status: 400 }
      );
    }

    const update: {
      name?: string;
      price?: number;
      image_url?: string;
      embedding?: number[];
    } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      update.name = name.trim();
    }
    if (price !== undefined) {
      if (typeof price !== 'number' || Number.isNaN(price)) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      }
      update.price = price;
    }

    if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      const { buffer, dataUrl } = await compressImageForClip(imageBase64);
      update.image_url = dataUrl;
      update.embedding = await getClipEmbeddingFromJpegBuffer(buffer);
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
      const raw = Buffer.from(await res.arrayBuffer());
      const { buffer } = await compressImageForClip(raw);
      update.image_url = url;
      update.embedding = await getClipEmbeddingFromJpegBuffer(buffer);
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
      .select(publicFields)
      .lean();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
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
