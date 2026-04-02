import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';

export async function GET(request: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (category && category !== 'all') filter.category = category;

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    return NextResponse.json({ products, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();

    const count = await Product.countDocuments();
    const productId = body.productId || `PRD-${String(count + 1).padStart(5, '0')}`;

    const product = await Product.create({ ...body, productId });
    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/products error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
