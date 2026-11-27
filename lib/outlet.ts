export interface OutletLike {
  code?: string | null
  name?: string | null
  type?: { code?: string | null } | null
}

export function isCafeOutlet(outlet?: OutletLike | null): boolean {
  if (!outlet) return false
  return (
    outlet.code === 'CAF' ||
    outlet.type?.code === 'CAFE' ||
    Boolean(outlet.name?.toLowerCase().includes('cafe'))
  )
}
