import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';
import { getImageEmbeddingFromJpegBuffer } from '@/lib/services/openaiImageEmbedding';
import { findNearestProductsByEmbedding } from '@/lib/services/vectorSearch';
import { PRODUCT_PUBLIC_FIELDS } from '@/lib/constants/productFields';
import { getVectorMatchMinScore } from '@/lib/constants/searchScores';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

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
      const product = await Product.findById(idStr).select(publicSelect).lean();
      if (product) {
        return NextResponse.json({ products: [product], matchType: 'exact' });
      }
      return NextResponse.json({ products: [], matchType: 'none' });
    }

    if (idStr && /^\d{5,7}$/.test(idStr)) {
      const product = await Product.findOne({ productCode: idStr })
        .select(publicSelect)
        .lean();
      if (product) {
        return NextResponse.json({ products: [product], matchType: 'code' });
      }
      return NextResponse.json({ products: [], matchType: 'none' });
    }

    const q = typeof query === 'string' ? query.trim() : '';
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const or: Record<string, unknown>[] = [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
      if (/^\d{5,7}$/.test(q)) {
        or.push({ productCode: q });
      }
      const products = await Product.find({ $or: or })
        .select(publicSelect)
        .limit(20)
        .lean();
      return NextResponse.json({ products, matchType: 'text' });
    }

    if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      const { buffer } = await compressImageForClip(imageBase64);
      const embedding = await getImageEmbeddingFromJpegBuffer(buffer);
      const minScore = getVectorMatchMinScore();
      const hits = await findNearestProductsByEmbedding(embedding, 20, 200);

      const matched = hits.filter((h) => h.score >= minScore);
      const similarProducts = hits
        .filter((h) => h.score < minScore)
        .slice(0, 8)
        .map((h) => ({
          _id: h._id,
          name: h.name,
          price: h.price,
          image_url: h.image_url,
          score: h.score,
        }));

      if (matched.length === 0) {
        return NextResponse.json({
          products: [],
          similarProducts,
          matchType: 'none',
          threshold: minScore,
        });
      }

      const ids = matched.map((m) => m._id);
      const docs = await Product.find({ _id: { $in: ids } })
        .select(publicSelect)
        .lean();
      const byId = new Map(docs.map((d) => [String(d._id), d]));
      const products = matched
        .map((m) => {
          const doc = byId.get(String(m._id));
          if (!doc) return null;
          return { ...doc, score: m.score };
        })
        .filter(Boolean);

      return NextResponse.json({
        products,
        similarProducts: similarProducts.length ? similarProducts : undefined,
        matchType: 'vector',
        threshold: minScore,
      });
    }

    return NextResponse.json(
      { error: 'Provide imageBase64, query, or id (24-char hex or 5–7 digit code)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('POST /api/products/search error:', error);
    const message = error instanceof Error ? error.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
