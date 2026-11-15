export const MODULES = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'pos', label: 'POS / Sales' },
    { key: 'orders', label: 'Orders' },
    { key: 'tables', label: 'Tables' },       // ← new
    { key: 'inventory', label: 'Inventory' },
    { key: 'customers', label: 'Customers' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'reports', label: 'Reports' },
    { key: 'users', label: 'Users' },
] as const

export type ModuleKey = typeof MODULES[number]['key']
export interface ModulePermission { view: boolean; edit: boolean; delete: boolean }
export type Permissions = Record<ModuleKey, ModulePermission>

const blank = (): ModulePermission => ({ view: false, edit: false, delete: false })
const full  = (): ModulePermission => ({ view: true,  edit: true,  delete: true  })

export const DEFAULT_PERMISSIONS: Permissions = Object.fromEntries(
    MODULES.map(m => [m.key, blank()])
) as Permissions

export const FULL_PERMISSIONS: Permissions = Object.fromEntries(
    MODULES.map(m => [m.key, full()])
) as Permissions

/** Check if a user has a specific permission. SUPER_ADMIN always passes. */
export function can(
    permissions: Permissions | null,
    role: string,
    module: ModuleKey,
    action: keyof ModulePermission
): boolean {
    if (role === 'SUPER_ADMIN') return true
    if (!permissions) return false
    return permissions[module]?.[action] ?? false
}

/** Parse raw JSON (from DB or JWT) into a Permissions object safely */
export function parsePermissions(raw: unknown): Permissions {
    const result: Permissions = { ...DEFAULT_PERMISSIONS }
    if (!raw || typeof raw !== 'object') return result
    const perms = raw as Record<string, unknown>
    for (const m of MODULES) {
        const mp = perms[m.key]
        if (mp && typeof mp === 'object') {
            const p = mp as Record<string, unknown>
            result[m.key] = {
                view:   Boolean(p.view),
                edit:   Boolean(p.edit),
                delete: Boolean(p.delete),
            }
        }
    }
    return result
}