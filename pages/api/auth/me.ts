import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  const freshUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      permissions: true,
      outlets: {
        select: {
          outletId: true,
          outlet: { select: { id: true, name: true, code: true } },
        },
      },
    },
  })

  if (!freshUser || !freshUser.active) {
    return res.status(401).json({ error: 'Account is deactivated or not found' })
  }

  return res.status(200).json({ user: freshUser })
}

export default withAuth(handler)
