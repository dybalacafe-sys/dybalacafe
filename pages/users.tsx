// pages/users.tsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import Layout from '@/components/Layout'
import { useAuth, apiFetch } from '@/lib/AuthContext'
import toast from 'react-hot-toast'
import {
    FiPlus, FiEdit2, FiSlash, FiSearch, FiMapPin,
    FiShield, FiCheckSquare, FiSquare, FiLayers, FiCheck
} from 'react-icons/fi'
import {
    MODULES, Permissions, ModuleKey, ModulePermission,
    DEFAULT_PERMISSIONS, FULL_PERMISSIONS, parsePermissions,
} from '@/lib/permissions'

interface OutletItem {
    id: number
    name: string
    code: string
    type?: { name: string }
}

interface UserOutletRelation {
    outletId: number
    outlet: OutletItem
}

interface User {
    id: number
    name: string
    email: string
    role: string
    active: boolean
    permissions: Permissions
    createdAt: string
    outlets?: UserOutletRelation[]
}

const ROLE_COLORS: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    ADMIN:       'bg-blue-100 text-blue-800 border-blue-200',
    STAFF:       'bg-gray-100 text-gray-800 border-gray-200',
}

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN:       'Admin',
    STAFF:       'Staff',
}

interface PlanPreset {
    id: string
    name: string
    role: 'STAFF' | 'ADMIN' | 'SUPER_ADMIN'
    badge: string
    description: string
    perms: Partial<Record<ModuleKey, Partial<ModulePermission>>>
}

const PRESET_PLANS: PlanPreset[] = [
    {
        id: 'super_admin',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        badge: 'bg-purple-100 text-purple-800 border-purple-200',
        description: 'Unrestricted master access to all system modules and outlets',
        perms: Object.fromEntries(MODULES.map(m => [m.key, { view: true, edit: true, delete: true }]))
    },
    {
        id: 'branch_manager',
        name: 'Branch Manager',
        role: 'ADMIN',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        description: 'Oversees daily outlet operations, sales, tables, inventory, expenses, and staff',
        perms: {
            dashboard: { view: true, edit: true, delete: false },
            pos:       { view: true, edit: true, delete: true },
            orders:    { view: true, edit: true, delete: true },
            tables:    { view: true, edit: true, delete: true },
            inventory: { view: true, edit: true, delete: true },
            customers: { view: true, edit: true, delete: true },
            expenses:  { view: true, edit: true, delete: true },
            reports:   { view: true, edit: false, delete: false },
            users:     { view: true, edit: true, delete: false },
        }
    },
    {
        id: 'cashier',
        name: 'Cashier / POS',
        role: 'STAFF',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        description: 'Point of sale, customer billing, table checkout, and receipt settlement',
        perms: {
            dashboard: { view: true, edit: false, delete: false },
            pos:       { view: true, edit: true, delete: false },
            orders:    { view: true, edit: true, delete: false },
            tables:    { view: true, edit: true, delete: false },
            inventory: { view: true, edit: false, delete: false },
            customers: { view: true, edit: true, delete: false },
            expenses:  { view: false, edit: false, delete: false },
            reports:   { view: false, edit: false, delete: false },
            users:     { view: false, edit: false, delete: false },
        }
    },
    {
        id: 'waiter',
        name: 'Waiter / Service',
        role: 'STAFF',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        description: 'Dining area tables, floor orders, and guest service requests',
        perms: {
            dashboard: { view: false, edit: false, delete: false },
            pos:       { view: true, edit: true, delete: false },
            orders:    { view: true, edit: true, delete: false },
            tables:    { view: true, edit: true, delete: false },
            inventory: { view: false, edit: false, delete: false },
            customers: { view: true, edit: false, delete: false },
            expenses:  { view: false, edit: false, delete: false },
            reports:   { view: false, edit: false, delete: false },
            users:     { view: false, edit: false, delete: false },
        }
    },
    {
        id: 'kitchen',
        name: 'Kitchen / Chef',
        role: 'STAFF',
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        description: 'Fulfill KOTs, view kitchen orders, and track raw ingredient stock',
        perms: {
            dashboard: { view: true, edit: false, delete: false },
            pos:       { view: false, edit: false, delete: false },
            orders:    { view: true, edit: true, delete: false },
            tables:    { view: false, edit: false, delete: false },
            inventory: { view: true, edit: true, delete: false },
            customers: { view: false, edit: false, delete: false },
            expenses:  { view: false, edit: false, delete: false },
            reports:   { view: false, edit: false, delete: false },
            users:     { view: false, edit: false, delete: false },
        }
    },
    {
        id: 'storekeeper',
        name: 'Storekeeper / Inventory',
        role: 'STAFF',
        badge: 'bg-teal-100 text-teal-800 border-teal-200',
        description: 'Stock logs, inward purchases, inventory items, and supplier adjustments',
        perms: {
            dashboard: { view: true, edit: false, delete: false },
            pos:       { view: false, edit: false, delete: false },
            orders:    { view: true, edit: false, delete: false },
            tables:    { view: false, edit: false, delete: false },
            inventory: { view: true, edit: true, delete: true },
            customers: { view: false, edit: false, delete: false },
            expenses:  { view: true, edit: true, delete: false },
            reports:   { view: true, edit: false, delete: false },
            users:     { view: false, edit: false, delete: false },
        }
    },
    {
        id: 'accountant',
        name: 'Auditor / Accountant',
        role: 'STAFF',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        description: 'Financial expense logging, sales revenue review, and audit reports',
        perms: {
            dashboard: { view: true, edit: false, delete: false },
            pos:       { view: true, edit: false, delete: false },
            orders:    { view: true, edit: false, delete: false },
            tables:    { view: false, edit: false, delete: false },
            inventory: { view: true, edit: false, delete: false },
            customers: { view: true, edit: false, delete: false },
            expenses:  { view: true, edit: true, delete: true },
            reports:   { view: true, edit: false, delete: false },
            users:     { view: false, edit: false, delete: false },
        }
    }
]

// Roles a given requester can assign
function assignableRoles(requesterRole: string): string[] {
    if (requesterRole === 'SUPER_ADMIN') return ['SUPER_ADMIN', 'ADMIN', 'STAFF']
    if (requesterRole === 'ADMIN')       return ['ADMIN', 'STAFF']
    return []
}

export default function UsersPage() {
    const { token, user: currentUser, can } = useAuth()
    const [users, setUsers]             = useState<User[]>([])
    const [outlets, setOutlets]         = useState<OutletItem[]>([])
    const [search, setSearch]           = useState('')
    const [filterOutlet, setFilterOutlet] = useState<string>('ALL')

    const [showModal, setShowModal]     = useState(false)
    const [editing, setEditing]         = useState<User | null>(null)
    const [form, setForm]               = useState({
        name: '', email: '', password: '', role: 'STAFF', active: true,
    })
    const [selectedOutletIds, setSelectedOutletIds] = useState<number[]>([])
    const [selectedPlanId, setSelectedPlanId]       = useState<string | null>(null)
    const [permissions, setPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS })
    const [saving, setSaving]           = useState(false)
    const [deactivating, setDeactivating] = useState<number | null>(null)

    const myRole = currentUser?.role ?? 'STAFF'
    const isSuperAdmin = myRole === 'SUPER_ADMIN'
    const allowedRoles = assignableRoles(myRole)

    // Load available outlets
    const fetchOutlets = useCallback(async () => {
        if (!token) return
        try {
            const data = await apiFetch('/api/outlets?all=true', {}, token)
            if (Array.isArray(data)) {
                setOutlets(data)
            }
        } catch (e) {
            console.error('Failed to load outlets', e)
        }
    }, [token])

    const fetchUsers = useCallback(async () => {
        if (!token) return
        try {
            const data = await apiFetch('/api/users', {}, token)
            const list = (data as User[]).map(u => ({ ...u, permissions: parsePermissions(u.permissions) }))
            setUsers(list)
        } catch (e) {
            console.error('Failed to load users', e)
        }
    }, [token])

    useEffect(() => {
        fetchUsers()
        fetchOutlets()
    }, [fetchUsers, fetchOutlets])

    const openAdd = () => {
        setEditing(null)
        const defaultRole = allowedRoles[allowedRoles.length - 1] ?? 'STAFF'
        setForm({ name: '', email: '', password: '', role: defaultRole, active: true })
        setPermissions({ ...DEFAULT_PERMISSIONS })
        setSelectedPlanId(null)
        // Default to all active outlets so user has immediate access
        setSelectedOutletIds(outlets.map(o => o.id))
        setShowModal(true)
    }

    const openEdit = (u: User) => {
        setEditing(u)
        setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active })
        setPermissions(parsePermissions(u.permissions))
        setSelectedPlanId(null)
        setSelectedOutletIds(u.outlets?.map(o => o.outletId) ?? [])
        setShowModal(true)
    }

    const canEdit = (target: User) => {
        if (!can('users', 'edit')) return false
        if (myRole === 'ADMIN' && target.role === 'SUPER_ADMIN') return false
        return true
    }

    // Apply role & permission plan preset
    const applyPresetPlan = (preset: PlanPreset) => {
        if (!allowedRoles.includes(preset.role)) {
            toast.error(`Your role cannot assign ${ROLE_LABELS[preset.role] || preset.role}`)
            return
        }

        setForm(f => ({ ...f, role: preset.role }))
        setSelectedPlanId(preset.id)

        if (preset.role === 'SUPER_ADMIN') {
            setPermissions({ ...FULL_PERMISSIONS })
        } else {
            const newPerms: Permissions = { ...DEFAULT_PERMISSIONS }
            for (const m of MODULES) {
                newPerms[m.key] = {
                    view: Boolean(preset.perms[m.key]?.view),
                    edit: Boolean(preset.perms[m.key]?.edit),
                    delete: Boolean(preset.perms[m.key]?.delete),
                }
            }
            setPermissions(newPerms)
        }
        toast.success(`Applied "${preset.name}" preset plan`)
    }

    const toggleOutlet = (outletId: number) => {
        setSelectedOutletIds(prev =>
            prev.includes(outletId)
                ? prev.filter(id => id !== outletId)
                : [...prev, outletId]
        )
    }

    const selectAllOutlets = () => setSelectedOutletIds(outlets.map(o => o.id))
    const deselectAllOutlets = () => setSelectedOutletIds([])

    const handleSave = async () => {
        if (!form.name.trim() || !form.email.trim()) {
            toast.error('Name and email are required')
            return
        }
        if (!editing && !form.password) {
            toast.error('Password is required for new users')
            return
        }
        if (form.role !== 'SUPER_ADMIN' && selectedOutletIds.length === 0) {
            if (!confirm('No outlets have been assigned to this user. They will not be able to access any outlet data. Continue?')) {
                return
            }
        }

        setSaving(true)
        try {
            if (editing) {
                const body: Record<string, unknown> = {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    role: form.role,
                    active: form.active,
                    permissions,
                    outletIds: selectedOutletIds,
                }
                if (form.password) body.password = form.password
                await apiFetch(`/api/users/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) }, token)
                toast.success('User updated successfully')
            } else {
                await apiFetch('/api/users', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...form,
                        permissions,
                        outletIds: selectedOutletIds,
                    }),
                }, token)
                toast.success('User created successfully')
            }
            setShowModal(false)
            fetchUsers()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Operation failed')
        } finally {
            setSaving(false)
        }
    }

    const handleDeactivate = async (u: User) => {
        if (!confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) return
        setDeactivating(u.id)
        try {
            await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' }, token)
            toast.success(`${u.name} deactivated`)
            fetchUsers()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed')
        } finally {
            setDeactivating(null)
        }
    }

    // Permission matrix helpers
    const togglePerm = (module: ModuleKey, action: 'view' | 'edit' | 'delete') => {
        setSelectedPlanId(null)
        setPermissions(prev => ({
            ...prev,
            [module]: { ...prev[module], [action]: !prev[module][action] },
        }))
    }

    const setAllForModule = (module: ModuleKey, value: boolean) => {
        setSelectedPlanId(null)
        setPermissions(prev => ({
            ...prev,
            [module]: { view: value, edit: value, delete: value },
        }))
    }

    const setAllForAction = (action: 'view' | 'edit' | 'delete', value: boolean) => {
        setSelectedPlanId(null)
        setPermissions(prev => {
            const next = { ...prev }
            for (const m of MODULES) next[m.key] = { ...next[m.key], [action]: value }
            return next
        })
    }

    const permCount = MODULES.reduce((sum, m) => {
        const p = permissions[m.key]
        return sum + (p.view ? 1 : 0) + (p.edit ? 1 : 0) + (p.delete ? 1 : 0)
    }, 0)
    const totalCount = MODULES.length * 3
    const isFormSuper = form.role === 'SUPER_ADMIN'

    // Filter users list
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch =
                u.name.toLowerCase().includes(search.toLowerCase()) ||
                u.email.toLowerCase().includes(search.toLowerCase()) ||
                u.role.toLowerCase().includes(search.toLowerCase())

            if (!matchesSearch) return false

            if (filterOutlet !== 'ALL') {
                const outletIdNum = Number(filterOutlet)
                if (u.role === 'SUPER_ADMIN') return true
                const hasOutlet = u.outlets?.some(o => o.outletId === outletIdNum)
                if (!hasOutlet) return false
            }

            return true
        })
    }, [users, search, filterOutlet])

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage user profiles, assign outlet branches, and customize role permission plans.
                        </p>
                    </div>
                    {can('users', 'edit') && (
                        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
                            <FiPlus size={16} /> Add User
                        </button>
                    )}
                </div>

                {/* Filter and Search Bar */}
                <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search users by name, email, or role..."
                            className="input pl-9 w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2 sm:w-64">
                        <FiMapPin className="text-gray-400 shrink-0" size={16} />
                        <select
                            value={filterOutlet}
                            onChange={e => setFilterOutlet(e.target.value)}
                            className="input text-sm w-full"
                        >
                            <option value="ALL">All Outlets</option>
                            {outlets.map(o => (
                                <option key={o.id} value={o.id.toString()}>
                                    {o.name} ({o.code})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Users Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredUsers.length === 0 ? (
                        <div className="col-span-full card p-12 text-center text-gray-500">
                            No users found matching your search.
                        </div>
                    ) : (
                        filteredUsers.map(u => {
                            const granted = MODULES.reduce((sum, m) => {
                                const p = parsePermissions(u.permissions)[m.key]
                                return sum + (p.view ? 1 : 0) + (p.edit ? 1 : 0) + (p.delete ? 1 : 0)
                            }, 0)
                            const isMe = u.id === currentUser?.userId
                            const editable = canEdit(u)
                            const assignedOutlets = u.outlets ?? []

                            return (
                                <div
                                    key={u.id}
                                    className={`card p-5 flex flex-col justify-between border transition-all ${
                                        !u.active
                                            ? 'border-red-200 bg-red-50/40 opacity-80'
                                            : isMe
                                                ? 'border-blue-300 bg-blue-50/20 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div>
                                        {/* Top avatar & actions */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm ${
                                                    u.role === 'SUPER_ADMIN' ? 'bg-gradient-to-tr from-purple-700 to-indigo-600'
                                                        : u.role === 'ADMIN' ? 'bg-gradient-to-tr from-blue-700 to-cyan-600'
                                                            : 'bg-gradient-to-tr from-gray-600 to-slate-500'
                                                }`}>
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <h3 className="font-semibold text-gray-900 leading-tight">{u.name}</h3>
                                                        {isMe && (
                                                            <span className="bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded text-[10px]">
                                                                YOU
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{u.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {isSuperAdmin && !isMe && u.active && (
                                                    <button
                                                        onClick={() => handleDeactivate(u)}
                                                        disabled={deactivating === u.id}
                                                        title="Deactivate account"
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                                    >
                                                        <FiSlash size={15} />
                                                    </button>
                                                )}
                                                {editable && (
                                                    <button
                                                        onClick={() => openEdit(u)}
                                                        title="Edit user & permissions"
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >
                                                        <FiEdit2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Role & Status pills */}
                                        <div className="flex items-center gap-2 mb-3.5 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-800'}`}>
                                                {ROLE_LABELS[u.role] ?? u.role}
                                            </span>
                                            {!u.active && (
                                                <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-xs font-medium">
                                                    Inactive
                                                </span>
                                            )}
                                            {u.role !== 'SUPER_ADMIN' ? (
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {granted}/{totalCount} perms
                                                </span>
                                            ) : (
                                                <span className="text-xs text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                                    ★ Full Access
                                                </span>
                                            )}
                                        </div>

                                        {/* Outlets Assigned Section */}
                                        <div className="pt-3 border-t border-gray-100">
                                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                                                <span className="flex items-center gap-1 font-medium text-gray-600">
                                                    <FiMapPin size={12} className="text-gray-400" /> Assigned Outlets:
                                                </span>
                                                {u.role === 'SUPER_ADMIN' && (
                                                    <span className="text-[11px] text-purple-600 font-medium">Global</span>
                                                )}
                                            </div>

                                            {u.role === 'SUPER_ADMIN' ? (
                                                <div className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-100">
                                                    <FiShield size={13} className="shrink-0" />
                                                    <span>All Outlets (Super Admin Master Access)</span>
                                                </div>
                                            ) : assignedOutlets.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {assignedOutlets.map(ao => (
                                                        <span
                                                            key={ao.outletId}
                                                            title={ao.outlet.name}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-medium"
                                                        >
                                                            <span className="font-bold text-[10px] bg-blue-200/60 px-1 rounded text-blue-800">
                                                                {ao.outlet.code}
                                                            </span>
                                                            <span className="truncate max-w-[150px]">{ao.outlet.name}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                                                    ⚠️ No outlets assigned (Login restricted)
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ── Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-3xl p-6 space-y-6 max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editing ? 'Edit User & Permissions' : 'Create New User'}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {editing
                                        ? `Configure outlets and permissions for ${editing.name}`
                                        : 'Set credentials, assign outlet access, and pick a role plan.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Basic Info Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Full Name *</label>
                                <input
                                    className="input"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Ram Shrestha"
                                />
                            </div>
                            <div>
                                <label className="label">Email Address *</label>
                                <input
                                    type="email"
                                    className="input"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="e.g. ram@dybala.com"
                                />
                            </div>
                            <div>
                                <label className="label">
                                    {editing ? 'New Password (leave empty to keep)' : 'Password *'}
                                </label>
                                <input
                                    type="password"
                                    className="input"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    placeholder={editing ? '••••••••' : 'Min 6 characters'}
                                />
                            </div>
                            <div>
                                <label className="label">Primary System Role</label>
                                <select
                                    className="input"
                                    value={form.role}
                                    onChange={e => {
                                        const newRole = e.target.value
                                        setForm(f => ({ ...f, role: newRole }))
                                        setSelectedPlanId(null)
                                        if (newRole === 'SUPER_ADMIN') setPermissions({ ...FULL_PERMISSIONS })
                                        else if (form.role === 'SUPER_ADMIN') setPermissions({ ...DEFAULT_PERMISSIONS })
                                    }}
                                >
                                    {allowedRoles.map(r => (
                                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Active toggle */}
                            {editing && can('users', 'edit') && editing.id !== currentUser?.userId && (
                                <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <input
                                        type="checkbox"
                                        id="active"
                                        checked={form.active}
                                        onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                                        className="w-4 h-4 accent-blue-600 rounded"
                                    />
                                    <label htmlFor="active" className="text-sm text-gray-700 cursor-pointer select-none">
                                        <span className="font-medium">Active Account</span>
                                        {!form.active && (
                                            <span className="ml-2 text-xs text-red-600 font-medium">
                                                — user cannot log in while inactive
                                            </span>
                                        )}
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* ── SECTION: Assigned Outlets ── */}
                        <div className="border border-blue-100 bg-blue-50/20 rounded-xl p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                        <FiMapPin className="text-blue-600" size={15} /> Assigned Outlets
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Select which branches/outlets this user is permitted to view and manage.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllOutlets}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deselectAllOutlets}
                                        className="text-xs font-medium text-gray-600 hover:text-gray-800 bg-white px-2 py-1 rounded border border-gray-200"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                {outlets.map(o => {
                                    const checked = selectedOutletIds.includes(o.id)
                                    return (
                                        <label
                                            key={o.id}
                                            onClick={() => toggleOutlet(o.id)}
                                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all ${
                                                checked
                                                    ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                                    checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                                                }`}>
                                                    {checked && <FiCheck size={12} strokeWidth={3} />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold leading-tight">{o.name}</p>
                                                    <p className="text-[11px] text-gray-500">
                                                        Code: <span className="font-semibold text-gray-700">{o.code}</span>
                                                        {o.type?.name ? ` • ${o.type.name}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                                                {o.code}
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>

                            {form.role === 'SUPER_ADMIN' && (
                                <p className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded p-2">
                                    ★ Super Admins automatically bypass branch filters, but assigning explicit outlets allows them to test scoped workflows.
                                </p>
                            )}
                        </div>

                        {/* ── SECTION: Role / Permission Plan Presets ── */}
                        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                    <FiLayers className="text-indigo-600" size={15} /> Quick Role & Permission Plan Presets
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Click a preset to quickly apply standard role permissions, or customize them manually below.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                {PRESET_PLANS.map(plan => {
                                    const canAssign = allowedRoles.includes(plan.role)
                                    const isSelected = selectedPlanId === plan.id
                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            disabled={!canAssign}
                                            onClick={() => applyPresetPlan(plan)}
                                            className={`p-2.5 rounded-lg border text-left transition-all relative flex flex-col justify-between ${
                                                isSelected
                                                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-400 text-indigo-950 shadow-sm'
                                                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/20 text-gray-800'
                                            } ${!canAssign ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-semibold text-xs leading-tight">{plan.name}</span>
                                                    {isSelected && <FiCheck className="text-indigo-600 shrink-0" size={13} />}
                                                </div>
                                                <p className="text-[11px] text-gray-500 line-clamp-2">{plan.description}</p>
                                            </div>
                                            <span className={`mt-2 inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded w-fit ${plan.badge}`}>
                                                {ROLE_LABELS[plan.role]}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ── SECTION: Module Permissions Matrix ── */}
                        {isFormSuper ? (
                            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800 flex items-start gap-2.5">
                                <FiShield className="text-purple-600 mt-0.5 shrink-0" size={17} />
                                <div>
                                    <span className="font-bold">Super Admin Full Privilege Mode:</span>
                                    <p className="text-xs text-purple-700 mt-0.5">
                                        Super Admins have unrestricted access to all modules, orders, POS, inventory, users, and audit reports without granular restrictions.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">Custom Module Permissions</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Fine-tune access for each functional module
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-500 bg-gray-200/70 px-2 py-0.5 rounded">
                                            {permCount}/{totalCount} active
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPlanId(null)
                                                setPermissions({ ...FULL_PERMISSIONS })
                                            }}
                                            className="text-xs font-semibold text-blue-600 hover:underline"
                                        >
                                            All
                                        </button>
                                        <span className="text-gray-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPlanId(null)
                                                setPermissions({ ...DEFAULT_PERMISSIONS })
                                            }}
                                            className="text-xs font-semibold text-gray-500 hover:underline"
                                        >
                                            None
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-semibold w-2/5">
                                                    Module
                                                </th>
                                                {(['view', 'edit', 'delete'] as const).map(action => (
                                                    <th key={action} className="text-center px-3 py-2 text-xs text-gray-500 font-semibold capitalize">
                                                        <div>{action}</div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const allOn = MODULES.every(m => permissions[m.key][action])
                                                                setAllForAction(action, !allOn)
                                                            }}
                                                            className="text-blue-500 hover:text-blue-700 text-[11px] font-normal"
                                                        >
                                                            {MODULES.every(m => permissions[m.key][action]) ? 'none' : 'all'}
                                                        </button>
                                                    </th>
                                                ))}
                                                <th className="text-center px-3 py-2 text-xs text-gray-500 font-semibold">
                                                    Row
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {MODULES.map(m => {
                                                const p = permissions[m.key]
                                                const rowAll = p.view && p.edit && p.delete
                                                return (
                                                    <tr key={m.key} className="hover:bg-gray-50/80">
                                                        <td className="px-4 py-2.5 font-medium text-gray-800 text-xs sm:text-sm">
                                                            {m.label}
                                                        </td>
                                                        {(['view', 'edit', 'delete'] as const).map(action => (
                                                            <td key={action} className="text-center px-3 py-2.5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={p[action]}
                                                                    onChange={() => togglePerm(m.key, action)}
                                                                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="text-center px-3 py-2.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setAllForModule(m.key, !rowAll)}
                                                                className="text-xs font-medium text-blue-500 hover:text-blue-700"
                                                            >
                                                                {rowAll ? 'clear' : 'all'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Save & Cancel Buttons */}
                        <div className="flex gap-3 pt-3 border-t border-gray-100">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="btn-primary flex-1 py-2.5 font-semibold disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn-secondary flex-1 py-2.5"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
