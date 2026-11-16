import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()

  try {
    // 1. Verify Database connectivity with lightweight query
    await prisma.$queryRaw`SELECT 1`
    const latency = `${Date.now() - startTime}ms`

    const mem = process.memoryUsage()

    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: 'connected',
        latency,
      },
      system: {
        nodeVersion: process.version,
        memoryRssMb: Math.round(mem.rss / 1024 / 1024),
        memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    })
  } catch (err: unknown) {
    console.error('[Health Check Failed]:', err)
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Database ping failed',
      },
    })
  }
}
