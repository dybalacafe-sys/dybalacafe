import { NextApiResponse } from 'next'

/**
 * Consistent JSON error response for API route catch blocks.
 */
export function handleApiError(res: NextApiResponse, err: unknown, context: string) {
  console.error(`[API ${context}]`, err)
  const message = err instanceof Error ? err.message : 'Internal server error'
  const status = message.startsWith('Forbidden') ? 403 : 500
  return res.status(status).json({ error: message })
}
