import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export let prisma: PrismaClient =
  (globalForPrisma.prisma as PrismaClient) ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/** Used by in-memory unit/integration test suites to inject mock clients with 0 DB writes */
export function setPrismaClient(client: any) {
  prisma = client as unknown as PrismaClient
}
