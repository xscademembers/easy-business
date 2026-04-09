import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { ensureUniqueProductCode } from '@/lib/utils/productCode';

/**
 * Assigns a unique 5–7 digit productCode to any product missing one.
 */
export async function POST() {
  try {
    await connectDB();
    const missing = await Product.find({
      $or: [
        { productCode: { $exists: false } },
        { productCode: null },
        { productCode: '' },
      ],
    })
      .select('_id')
      .lean();

    let updated = 0;
    for (const p of missing) {
      const code = await ensureUniqueProductCode(Product, null);
      await Product.updateOne({ _id: p._id }, { $set: { productCode: code } });
      updated += 1;
    }

    return NextResponse.json({
      updated,
      scanned: missing.length,
    });
  } catch (error) {
    console.error('POST /api/products/backfill-codes error:', error);
    const message =
      error instanceof Error ? error.message : 'Backfill failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
