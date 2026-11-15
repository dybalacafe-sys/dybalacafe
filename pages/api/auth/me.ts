import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  return res.status(200).json({ user })
}

export default withAuth(handler)
