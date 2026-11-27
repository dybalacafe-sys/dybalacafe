import { z } from 'zod'

export const createExpenseSchema = z.object({
  category: z.string().trim().min(1, 'Category is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  description: z.string().trim().max(500).optional(),
  date: z.string().optional(),
})

export type CreateExpensePayload = z.infer<typeof createExpenseSchema>
