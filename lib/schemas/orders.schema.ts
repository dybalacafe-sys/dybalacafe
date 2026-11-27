import { z } from 'zod'

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required'),
  customerPhone: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive(),
        price: z.coerce.number().nonnegative(),
      })
    )
    .min(1, 'At least one item is required'),
  advancePaid: z.coerce.number().nonnegative().optional().default(0),
  deliveryDate: z.string().optional(),
  note: z.string().trim().max(500).optional(),
})

export type CreateOrderPayload = z.infer<typeof createOrderSchema>
