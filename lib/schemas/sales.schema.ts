import { z } from 'zod'

export const saleItemSchema = z.object({
  productId: z.coerce.number().int().positive('Invalid product ID'),
  quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
  price: z.coerce.number().nonnegative().optional(),
})

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Cart cannot be empty'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative').optional().default(0),
  paymentMethod: z.enum(['cash', 'card', 'qr', 'credit', 'online']).optional().default('cash'),
  customerPhone: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
  terminalId: z.coerce.number().int().positive().optional(),
})

export const getSalesQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

export type CreateSalePayload = z.infer<typeof createSaleSchema>
export type GetSalesQuery = z.infer<typeof getSalesQuerySchema>
