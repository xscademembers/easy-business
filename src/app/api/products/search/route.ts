import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';
import { getImageEmbeddingFromJpegBuffer } from '@/lib/services/openaiImageEmbedding';
import { findNearestProductsByEmbedding } from '@/lib/services/vectorSearch';

const publicFields = 'name price image_url';

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { imageBase64, query, id } = body as {
      imageBase64?: string;
      query?: string;
      id?: string;
    };

    const idStr = typeof id === 'string' ? id.trim() : '';
    if (idStr && /^[0-9a-fA-F]{24}$/.test(idStr)) {
      const product = await Product.findById(idStr).select(publicFields).lean();
      if (product) {
        return NextResponse.json({ products: [product], matchType: 'exact' });
      }
      return NextResponse.json({ products: [], matchType: 'none' });
    }

    const q = typeof query === 'string' ? query.trim() : '';
    if (q) {
      const products = await Product.find({
        name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      })
        .select(publicFields)
        .limit(20)
        .lean();
      return NextResponse.json({ products, matchType: 'text' });
    }

    if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      const { buffer } = await compressImageForClip(imageBase64);
      const embedding = await getImageEmbeddingFromJpegBuffer(buffer);
      const hits = await findNearestProductsByEmbedding(embedding, 1);

      if (hits.length === 0) {
        return NextResponse.json({ products: [], matchType: 'none' });
      }

      const top = hits[0]!;
      return NextResponse.json({
        products: [
          {
            _id: top._id,
            name: top.name,
            price: top.price,
            image_url: top.image_url,
            score: top.score,
          },
        ],
        matchType: 'vector',
      });
    }

    return NextResponse.json(
      { error: 'Provide imageBase64, query, or id (24-char hex)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('POST /api/products/search error:', error);
    const message = error instanceof Error ? error.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
