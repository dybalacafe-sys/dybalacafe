import { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, JWTPayload } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function handler(req: NextApiRequest, res: NextApiResponse, user: JWTPayload) {
  if (req.method === 'GET') {
    const isSuperAdmin = user.role === 'SUPER_ADMIN'
    const showAll = isSuperAdmin || (req.query.all === 'true' && ['SUPER_ADMIN', 'ADMIN'].includes(user.role))

    const outlets = await prisma.outlet.findMany({
      where: {
        active: true,
        ...(showAll
          ? {}
          : {
              users: {
                some: {
                  userId: user.userId,
                },
              },
            }),
      },
      include: {
        type: true,
        terminals: {
          where: { active: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return res.status(200).json(outlets)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
