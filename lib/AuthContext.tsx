import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { Permissions, ModuleKey, ModulePermission, parsePermissions, can as canCheck, DEFAULT_PERMISSIONS } from './permissions'

export interface Outlet {
  id: number
  name: string
  code: string
  typeId: number
  posEnabled: boolean
  hasTables: boolean
  usesRecipes: boolean
  active: boolean
  type?: { id: number; name: string; code: string }
  terminals?: { id: number; name: string; active: boolean }[]
}

interface User {
  userId: number
  name: string
  email: string
  role: string
  permissions: Permissions
}

interface AuthContextType {
  user: User | null
  token: string | null
  outlets: Outlet[]
  selectedOutlet: Outlet | null
  setSelectedOutlet: (outlet: Outlet) => void
  refreshOutlets: () => Promise<void>
  login: (token: string, user: User) => void
  logout: () => void
  loading: boolean
  can: (module: ModuleKey, action: keyof ModulePermission) => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  outlets: [],
  selectedOutlet: null,
  setSelectedOutlet: () => {},
  refreshOutlets: async () => {},
  login: () => {},
  logout: () => {},
  loading: true,
  can: () => false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [selectedOutlet, setSelectedOutletState] = useState<Outlet | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshOutlets = async (userToken = token) => {
    if (!userToken) return
    try {
      const res = await fetch('/api/outlets', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
      })
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data)) { setOutlets([]); return; }
      setOutlets(data)

      const savedOutletId = localStorage.getItem('bms_outlet_id')
      if (savedOutletId) {
        const found = data.find((o) => o.id.toString() === savedOutletId)
        if (found) {
          setSelectedOutletState(found)
          return
        }
      }
      if (data.length > 0) {
        setSelectedOutletState(data[0])
        localStorage.setItem('bms_outlet_id', data[0].id.toString())
      }
    } catch (e) {
      console.error('Failed to load outlets', e)
    }
  }

  const setSelectedOutlet = (outlet: Outlet) => {
    setSelectedOutletState(outlet)
    localStorage.setItem('bms_outlet_id', outlet.id.toString())
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('bms_token')
    const savedUser = localStorage.getItem('bms_user')
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        parsed.permissions = parsePermissions(parsed.permissions)
        setToken(savedToken)
        setUser(parsed)
        refreshOutlets(savedToken)
      } catch {
        localStorage.removeItem('bms_token')
        localStorage.removeItem('bms_user')
      }
    }
    setLoading(false)
  }, [])

  const login = (newToken: string, newUser: User) => {
    const userWithPerms = { ...newUser, permissions: parsePermissions(newUser.permissions) }
    localStorage.setItem('bms_token', newToken)
    localStorage.setItem('bms_user', JSON.stringify(userWithPerms))
    setToken(newToken)
    setUser(userWithPerms)
    refreshOutlets(newToken)
  }

  const logout = () => {
    localStorage.removeItem('bms_token')
    localStorage.removeItem('bms_user')
    localStorage.removeItem('bms_outlet_id')
    setToken(null)
    setUser(null)
    setOutlets([])
    setSelectedOutletState(null)
    router.push('/login')
  }

  const can = (module: ModuleKey, action: keyof ModulePermission): boolean => {
    if (!user) return false
    return canCheck(user.permissions ?? DEFAULT_PERMISSIONS, user.role, module, action)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        outlets,
        selectedOutlet,
        setSelectedOutlet,
        refreshOutlets,
        login,
        logout,
        loading,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export async function apiFetch(
  url: string,
  options: RequestInit = {},
  token?: string | null,
  outletId?: number | null
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  // Attach active outlet if available
  const activeOutletId =
    outletId ||
    (typeof window !== 'undefined' ? localStorage.getItem('bms_outlet_id') : null)
  if (activeOutletId) {
    headers['x-outlet-id'] = activeOutletId.toString()
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && typeof data === 'object' && 'error' in data ? String(data.error) : null) || `Request failed (HTTP ${res.status})`)
  return data
}
