import mongoose from 'mongoose';
import {
  EMBEDDING_DIMENSION,
  PRODUCTS_COLLECTION,
} from '@/lib/constants/vectorSearch';

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image_url: { type: String, required: true },
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
