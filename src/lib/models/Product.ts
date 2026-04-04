import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema({
  size: String,
  color: String,
  material: String,
  price: Number,
});

const ProductSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    stock: { type: Number, required: true, default: 0 },
    price: { type: Number, required: true },
    category: {
      type: String,
      required: true,
      enum: ['clothing', 'electronics', 'food', 'utensils', 'other'],
    },
    image: { type: String, default: '' },
    featureCode: { type: String, default: '' },
    /** Fingerprint pipeline version; image search only matches v2+ (background-removed / cropped). */
    featureCodeVersion: { type: Number, default: 1 },
    variants: [VariantSchema],
    categoryFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.Product ||
  mongoose.model('Product', ProductSchema);
