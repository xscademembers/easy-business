import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compareHashes } from '@/lib/imageUtils';
import { PRODUCT_FEATURE_PIPELINE_VERSION } from '@/lib/productFeatureConstants';

export async function POST(request: Request) {
  try {
    await connectDB();
    const { featureCode, productId, query } = await request.json();

    if (productId) {
      const product = await Product.findOne({
        $or: [{ productId }, { _id: productId.match(/^[0-9a-fA-F]{24}$/) ? productId : undefined }],
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
        ],
      })
        .limit(20)
        .lean();
      return NextResponse.json({ products, matchType: 'text' });
    }

    if (featureCode) {
      const allProducts = await Product.find({
        featureCode: { $ne: '' },
        featureCodeVersion: PRODUCT_FEATURE_PIPELINE_VERSION,
      }).lean();
      const matches = allProducts
        .map((p) => ({
          product: p,
          similarity: compareHashes(featureCode, p.featureCode),
        }))
        .filter((m) => m.similarity >= 95)
        .sort((a, b) => b.similarity - a.similarity);

      if (matches.length > 0) {
        return NextResponse.json({
          products: matches.map((m) => ({ ...m.product, similarity: m.similarity })),
          matchType: 'image',
        });
      }
      return NextResponse.json({ products: [], matchType: 'none' });
    }

    return NextResponse.json(
      { error: 'Provide featureCode, productId, or query' },
      { status: 400 }
    );
  } catch (error) {
    console.error('POST /api/products/search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
