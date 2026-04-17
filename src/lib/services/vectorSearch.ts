import type { Types } from 'mongoose';
import Product from '@/lib/models/Product';
import { MONGODB_DB_NAME } from '@/lib/mongodb';
import {
  EMBEDDING_DIMENSION,
  VECTOR_INDEX_NAME,
} from '@/lib/constants/vectorSearch';
import {
  FAST_VECTOR_LIMIT,
  FAST_VECTOR_NUM_CANDIDATES,
  coerceAttributes,
  type ProductAttributes,
} from '@/lib/constants/duplicateDetection';

export interface VectorSearchHit {
  _id: Types.ObjectId;
  name: string;
  price: number;
  image_url: string;
  score: number;
}

export interface VectorSearchHitWithAttributes extends VectorSearchHit {
  attributes: ProductAttributes;
}

/**
 * Atlas Vector Search on the `embedding` field (cosine similarity).
 * Requires index `vector_index` on collection `products`.
 *
 * Defaults are tuned for latency over recall: small catalogs don't need a
 * wide candidate scan. Callers that truly need more results can raise them.
 */
export async function findNearestProductsByEmbedding(
  queryVector: number[],
  limit: number = FAST_VECTOR_LIMIT,
  numCandidates: number = FAST_VECTOR_NUM_CANDIDATES
): Promise<VectorSearchHit[]> {
  if (queryVector.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `queryVector must have length ${EMBEDDING_DIMENSION}, got ${queryVector.length}`
    );
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: 'embedding',
        queryVector,
        numCandidates,
        limit,
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        price: 1,
        image_url: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  let results: Record<string, unknown>[];
  try {
    results = await Product.collection.aggregate(pipeline).toArray();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${msg} — Create an Atlas Vector Search index named "${VECTOR_INDEX_NAME}" on ${MONGODB_DB_NAME}.products (field "embedding", ${EMBEDDING_DIMENSION} dimensions, similarity "cosine"). If you use a different database, set MONGODB_DB_NAME and recreate the index there.`
    );
  }

  return results.map((doc) => ({
    _id: doc._id as Types.ObjectId,
    name: doc.name as string,
    price: doc.price as number,
    image_url: doc.image_url as string,
    score: typeof doc.score === 'number' ? doc.score : 0,
  }));
}

/**
 * Variant used by the duplicate-detection path: projects the stored
 * attributes alongside the standard fields so we can make the final
 * same/new decision without a second round-trip to Mongo.
 */
export async function findNearestProductsWithAttributes(
  queryVector: number[],
  limit: number = FAST_VECTOR_LIMIT,
  numCandidates: number = FAST_VECTOR_NUM_CANDIDATES
): Promise<VectorSearchHitWithAttributes[]> {
  if (queryVector.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `queryVector must have length ${EMBEDDING_DIMENSION}, got ${queryVector.length}`
    );
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: 'embedding',
        queryVector,
        numCandidates,
        limit,
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        price: 1,
        image_url: 1,
        attributes: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  let results: Record<string, unknown>[];
  try {
    results = await Product.collection.aggregate(pipeline).toArray();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${msg} — Atlas vector search failed. Ensure index "${VECTOR_INDEX_NAME}" exists on ${MONGODB_DB_NAME}.products (field "embedding", ${EMBEDDING_DIMENSION} dims, cosine).`
    );
  }

  return results.map((doc) => ({
    _id: doc._id as Types.ObjectId,
    name: doc.name as string,
    price: doc.price as number,
    image_url: doc.image_url as string,
    score: typeof doc.score === 'number' ? doc.score : 0,
    attributes: coerceAttributes(doc.attributes),
  }));
}
