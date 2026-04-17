import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { normalizeProductImage } from '@/lib/services/imageNormalize';
import { dHashFromGrayscale9x8 } from '@/lib/services/imageHash';
import { getImageEmbeddingFromJpegBuffer } from '@/lib/services/openaiImageEmbedding';
import { findNearestProductsByEmbedding } from '@/lib/services/vectorSearch';
import { PRODUCT_PUBLIC_FIELDS } from '@/lib/constants/productFields';
import {
  getVectorMatchMinScore,
  normalizeVectorMatchScore,
} from '@/lib/constants/searchScores';
import {
  FAST_VECTOR_LIMIT,
  FAST_VECTOR_NUM_CANDIDATES,
} from '@/lib/constants/duplicateDetection';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

async function hydrateHitsWithDocs(
  hits: Array<{
    _id: unknown;
    name: string;
    price: number;
    image_url: string;
    score: number;
  }>
): Promise<Record<string, unknown>[]> {
  if (!hits.length) return [];
  const ids = hits.map((h) => h._id);
  const docs = await Product.find({ _id: { $in: ids } })
    .select(publicSelect)
    .lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return hits.map((h) => {
    const doc = byId.get(String(h._id));
    if (!doc) {
      return {
        _id: h._id,
        name: h.name,
        price: h.price,
        image_url: h.image_url,
        score: h.score,
        quantity: 0,
      };
    }
    return { ...doc, score: h.score };
  });
}

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
        .limit(12)
        .lean();
      return NextResponse.json({ products, matchType: 'text' });
    }

    if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      const normalized = await normalizeProductImage(imageBase64);

      // Fast-path: if the query image has been indexed before (rotated or
      // not) we can return immediately without any OpenAI round-trip.
      const canonicalHash = dHashFromGrayscale9x8(normalized.grayHash);
      const hashHit = await Product.findOne({ imageHashes: canonicalHash })
        .select(publicSelect)
        .lean();
      if (hashHit) {
        return NextResponse.json({
          products: [{ ...hashHit, score: 1 }],
          matchType: 'hash',
          threshold: 1,
        });
      }

      // Single vision + embedding call, then one $vectorSearch. Rotation
      // invariance is handled by the hash fast-path above (products store
      // all 4 rotation dHashes). Fan-out here is kept tight to avoid OpenAI
      // concurrency limits that previously blew latency past 15 s.
      const embedding = await getImageEmbeddingFromJpegBuffer(normalized.buffer);
      const hits = await findNearestProductsByEmbedding(
        embedding,
        FAST_VECTOR_LIMIT,
        FAST_VECTOR_NUM_CANDIDATES
      );

      const ranked = hits
        .map((h) => ({
          _id: h._id,
          name: h.name,
          price: h.price,
          image_url: h.image_url,
          score: normalizeVectorMatchScore(h.score),
        }))
        .sort((a, b) => b.score - a.score);

      // Always surface the top 3 even below the soft threshold so a rotated
      // / off-angle photo still gets a useful response. The UI uses
      // `matchType` to distinguish "strong" from "suggested" matches.
      const topN = ranked.slice(0, 3);
      const threshold = getVectorMatchMinScore();
      const products = await hydrateHitsWithDocs(topN);
      const topScore = topN[0]?.score ?? 0;

      return NextResponse.json({
        products,
        matchType:
          products.length === 0
            ? 'none'
            : topScore >= threshold
              ? 'vector'
              : 'suggested',
        threshold,
        vectorMeta: { topScore },
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
