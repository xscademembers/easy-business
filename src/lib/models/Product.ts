import mongoose from 'mongoose';
import {
  EMBEDDING_DIMENSION,
  PRODUCTS_COLLECTION,
} from '@/lib/constants/vectorSearch';

const AttributesSchema = new mongoose.Schema(
  {
    product_type: { type: String, default: '' },
    brand: { type: String, default: '' },
    primary_color: { type: String, default: '' },
    secondary_color: { type: String, default: '' },
    pattern: { type: String, default: '' },
    shape: { type: String, default: '' },
    logo_text: { type: String, default: '' },
    unique_features: { type: String, default: '' },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 0 },
    category: { type: String, required: true, default: 'general' },
    sizes: { type: [String], default: undefined },
    productCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    image_url: { type: String, required: true },
    /**
     * Perceptual hashes (dHash) computed at 0°/90°/180°/270°. Indexed to give
     * us an O(1) exact-duplicate lookup on re-uploads, including rotated
     * variants of the same photo.
     */
    imageHashes: {
      type: [String],
      default: undefined,
      index: true,
    },
    /**
     * Strict visual attributes extracted at upload time. Used alongside the
     * cosine similarity threshold to avoid treating colour/pattern variants
     * as duplicates.
     */
    attributes: { type: AttributesSchema, default: () => ({}) },
    embedding: {
      type: [Number],
      required: true,
      select: false,
      validate: {
        validator(v: number[]) {
          return Array.isArray(v) && v.length === EMBEDDING_DIMENSION;
        },
        message: `embedding must be an array of ${EMBEDDING_DIMENSION} numbers`,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Product ||
  mongoose.model('Product', ProductSchema, PRODUCTS_COLLECTION);
