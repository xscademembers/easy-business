import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';
import { getImageEmbeddingFromJpegBuffer } from '@/lib/services/openaiImageEmbedding';
import { findNearestProductsByEmbedding } from '@/lib/services/vectorSearch';
import { extractDigitCodesFromJpegBuffer } from '@/lib/services/extractDigitCodesFromImage';
import { PRODUCT_PUBLIC_FIELDS } from '@/lib/constants/productFields';
import { getVectorUploadDuplicateMinScore } from '@/lib/constants/searchScores';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

/**
 * Admin / upload flow: nearest visual neighbor + OCR-style digit codes for restock hints.
 */
export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { imageBase64, extractCodes = true } = body as {
      imageBase64?: string;
      extractCodes?: boolean;
    };

    if (typeof imageBase64 !== 'string' || !imageBase64.length) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 }
      );
    }

    const { buffer } = await compressImageForClip(imageBase64);
    const dupThreshold = getVectorUploadDuplicateMinScore();

    const [embedding, ocrCodes] = await Promise.all([
      getImageEmbeddingFromJpegBuffer(buffer),
      extractCodes
        ? extractDigitCodesFromJpegBuffer(buffer)
        : Promise.resolve([] as string[]),
    ]);

    const hits = await findNearestProductsByEmbedding(embedding, 6, 200);
    const top = hits[0];
    const duplicateCandidate =
      top && top.score >= dupThreshold
        ? await Product.findById(top._id).select(publicSelect).lean()
        : null;

    let codeMatch: { productCode: string; product: Record<string, unknown> } | null =
      null;

    if (ocrCodes.length) {
      for (const code of ocrCodes) {
        const found = await Product.findOne({ productCode: code })
          .select(publicSelect)
          .lean();
        if (found) {
          codeMatch = {
            productCode: code,
            product: found as Record<string, unknown>,
          };
          break;
        }
      }
    }

    return NextResponse.json({
      duplicateCandidate:
        duplicateCandidate && top
          ? { ...duplicateCandidate, similarityScore: top.score }
          : null,
      nearestNeighbors: hits.map((h) => ({
        _id: h._id,
        name: h.name,
        price: h.price,
        image_url: h.image_url,
        score: h.score,
      })),
      ocrCodes,
      codeMatch,
      duplicateThreshold: dupThreshold,
    });
  } catch (error) {
    console.error('POST /api/products/similar-check error:', error);
    const message =
      error instanceof Error ? error.message : 'Similar check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
