import { z } from 'zod'

export const createPurchaseSchema = z.object({
  supplierId: z.coerce.number().int().positive('Supplier is required'),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive(),
        costPrice: z.coerce.number().nonnegative(),
      })
    )
    .min(1, 'At least one item is required'),
  paid: z.coerce.number().nonnegative('Paid amount cannot be negative').optional().default(0),
  note: z.string().trim().max(500).optional(),
})

export const purchasePaymentSchema = z.object({
  supplierId: z.coerce.number().int().positive('Supplier is required'),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  note: z.string().trim().max(500).optional(),
})

export type CreatePurchasePayload = z.infer<typeof createPurchaseSchema>
export type PurchasePaymentPayload = z.infer<typeof purchasePaymentSchema>
