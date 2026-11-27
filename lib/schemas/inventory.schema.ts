import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  price: z.coerce.number().nonnegative('Price cannot be negative'),
  costPrice: z.coerce.number().nonnegative('Cost price cannot be negative').optional().default(0),
  stock: z.coerce.number().int().nonnegative('Stock cannot be negative').optional().default(0),
  minStock: z.coerce.number().int().nonnegative('Min stock cannot be negative').optional().default(5),
  unit: z.string().trim().min(1).optional().default('pcs'),
  type: z.enum(['raw', 'finished']).optional().default('finished'),
  categoryId: z.coerce.number().int().positive().optional(),
})

export const stockAdjustSchema = z.object({
  productId: z.coerce.number().int().positive('Invalid product'),
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
  note: z.string().trim().max(500).optional(),
})

export type CreateProductPayload = z.infer<typeof createProductSchema>
export type StockAdjustPayload = z.infer<typeof stockAdjustSchema>
