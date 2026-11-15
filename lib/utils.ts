import { NextApiRequest, NextApiResponse } from 'next'

export function apiHandler(methods: {
  [key: string]: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
}) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const handler = methods[req.method || 'GET']
    if (!handler) {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    try {
      await handler(req, res)
    } catch (error: unknown) {
      console.error('API Error:', error)
      const message = error instanceof Error ? error.message : 'Internal server error'
      return res.status(500).json({ error: message })
    }
  }
}

export function formatCurrency(amount: number): string {
  return `NPR ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function generateOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `ORD-${dateStr}-${rand}`
}
