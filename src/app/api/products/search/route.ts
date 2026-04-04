import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compareHashes } from '@/lib/imageUtils';
import { PRODUCT_FEATURE_PIPELINE_VERSION } from '@/lib/productFeatureConstants';
import { compareOcrTexts } from '@/lib/ocrUtils';

export async function POST(request: Request) {
  try {
    await connectDB();
    const { featureCode, ocrText, productId, query } = await request.json();

    if (productId) {
      const product = await Product.findOne({
        $or: [
          { productId },
          { _id: productId.match(/^[0-9a-fA-F]{24}$/) ? productId : undefined },
        ],
      }).lean();
      if (product) {
        return NextResponse.json({ products: [product], matchType: 'exact' });
      }
      return NextResponse.json({ products: [], matchType: 'none' });
    }

    if (query) {
      const products = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { productId: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { ocrText: { $regex: query, $options: 'i' } },
        ],
      })
        .limit(20)
        .lean();
      return NextResponse.json({ products, matchType: 'text' });
    }

    if (ocrText || featureCode) {
      const allProducts = await Product.find({
        $or: [
          { ocrText: { $ne: '' } },
          {
            featureCode: { $ne: '' },
            featureCodeVersion: PRODUCT_FEATURE_PIPELINE_VERSION,
          },
        ],
      }).lean();

      const scored = allProducts.map((p) => {
        const ocrScore =
          ocrText && p.ocrText ? compareOcrTexts(p.ocrText, ocrText) : 0;

        const hashScore =
          featureCode &&
          p.featureCode &&
          p.featureCodeVersion === PRODUCT_FEATURE_PIPELINE_VERSION
            ? compareHashes(featureCode, p.featureCode)
            : 0;

        return { product: p, ocrScore, hashScore };
      });

      /*
       * Matching strategy:
       *   1. Text-from-photo match is primary — ≥55% word overlap (fuzzy).
       *   2. Visual similarity is backup when little or no text is read.
       *
       * The containment algorithm already ignores background words, so changed
       * backgrounds don't lower the score. Rotation/zoom are partially handled by
       * image preprocessing (grayscale + contrast) and the visual hash backup.
       */
      const OCR_THRESHOLD = 55;
      const HASH_THRESHOLD = 75;

      const matches = scored
        .filter(
          (m) => m.ocrScore >= OCR_THRESHOLD || m.hashScore >= HASH_THRESHOLD
        )
        .sort((a, b) => {
          if (a.ocrScore !== b.ocrScore) return b.ocrScore - a.ocrScore;
          return b.hashScore - a.hashScore;
        });

      if (matches.length > 0) {
        return NextResponse.json({
          products: matches.map((m) => ({
            ...m.product,
            similarity: Math.max(m.ocrScore, m.hashScore),
            ocrScore: m.ocrScore,
            hashScore: m.hashScore,
          })),
          matchType: 'image',
        });
      }

      return NextResponse.json({ products: [], matchType: 'none' });
    }

    return NextResponse.json(
      { error: 'Provide featureCode, ocrText, productId, or query' },
      { status: 400 }
    );
  } catch (error) {
    console.error('POST /api/products/search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
