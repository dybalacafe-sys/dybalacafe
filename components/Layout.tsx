import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import {
  FiHome, FiShoppingCart, FiUsers,
  FiBarChart2, FiLogOut, FiMenu, FiX, FiDollarSign,
  FiShoppingBag, FiUser, FiGrid, FiMapPin, FiChevronDown, FiChevronLeft, FiChevronRight
} from 'react-icons/fi'
import { ModuleKey } from '@/lib/permissions'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
  module: ModuleKey
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <FiHome />, module: 'dashboard' },
  { href: '/pos', label: 'POS / Sales', icon: <FiShoppingCart />, module: 'pos' },
  { href: '/table-orders', label: 'Tables', icon: <FiGrid />, module: 'tables' },
  { href: '/inventory', label: 'Inventory', icon: <FiShoppingBag />, module: 'inventory' },
  { href: '/expenses', label: 'Expenses & Vendors', icon: <FiDollarSign />, module: 'expenses' },
  { href: '/customers', label: 'Customers / Credit', icon: <FiUser />, module: 'customers' },
  { href: '/reports', label: 'Reports', icon: <FiBarChart2 />, module: 'reports' },
  { href: '/users', label: 'Users', icon: <FiUsers />, module: 'users' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, can, outlets, selectedOutlet, setSelectedOutlet } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('bms_sidebar_collapsed') === 'true') {
      setSidebarCollapsed(true)
    }
  }, [])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('bms_sidebar_collapsed', String(next))
      }
      return next
    })
  }

  const isCafe = selectedOutlet?.code === 'CAF' || selectedOutlet?.type?.code === 'CAFE' || selectedOutlet?.name?.toLowerCase().includes('cafe')

  // In Cafe, POS is hidden. Reports and Users remain in the sidebar as it is.
  const filteredNav = navItems.filter(item => {
    if (!can(item.module, 'view')) return false
    if (isCafe && item.module === 'pos') {
      return false
    }
    return true
  })

  const handleOutletChange = (outletId: number) => {
    const target = outlets.find(o => o.id === outletId)
    if (target) {
      setSelectedOutlet(target)
      // Refresh current page to apply new outlet context
      router.replace(router.asPath)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} bg-gray-900 text-white transform transition-all duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto flex flex-col justify-between`}
      >
        <div>
          <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'justify-between'} p-4 border-b border-gray-700`}>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-white">Dybala BMS</h1>
                <p className="text-xs text-gray-400">
                  {isCafe ? 'Cafe & Bakery Suite' : 'Multi-Outlet Management'}
                </p>
              </div>
            )}
            <button
              className="hidden lg:inline-flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
            </button>
            <button className="lg:hidden text-gray-400" onClick={() => setSidebarOpen(false)}>
              <FiX size={20} />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {filteredNav.map((item) => {
              const active = router.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                >
                  <span className="text-lg shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-700">
          <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-3'} mb-3`}>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-400">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
            className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-2'} text-gray-400 hover:text-white text-sm w-full transition-colors`}
          >
            <FiLogOut className="shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between relative z-30">
          <button className="lg:hidden text-gray-600" onClick={() => setSidebarOpen(true)}>
            <FiMenu size={22} />
          </button>

          <div className="text-sm text-gray-500 hidden sm:block">
            {new Date().toLocaleDateString('en-NP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          <div className="flex items-center gap-3">
            {/* Quick outlet switch on top header */}
            {outlets.length > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium">
                <FiMapPin className="text-blue-600" size={13} />
                <span className="hidden md:inline text-gray-500">Outlet:</span>
                <select
                  aria-label="Active Outlet (Header)"
                  value={selectedOutlet?.id || ''}
                  onChange={(e) => handleOutletChange(Number(e.target.value))}
                  className="appearance-none bg-transparent text-blue-900 font-semibold focus:outline-none cursor-pointer text-xs"
                >
                  {(outlets || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <FiChevronDown size={12} className="text-blue-500" />
              </div>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <span className="text-sm text-gray-700 font-medium">Hi, {user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
