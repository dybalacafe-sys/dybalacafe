import { useState } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/AuthContext'
import Layout from '@/components/Layout'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'

const NO_LAYOUT_ROUTES = ['/login', '/setup']

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pos': 'POS',
  '/table-orders': 'Tables',
  '/inventory': 'Inventory',
  '/expenses': 'Expenses & Vendors',
  '/customers': 'Customers & Credit',
  '/reports': 'Reports',
  '/users': 'Users',
  '/login': 'Login',
  '/setup': 'Setup',
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  const showLayout = !NO_LAYOUT_ROUTES.includes(router.pathname)
  const pageTitle = PAGE_TITLES[router.pathname]
  const fullTitle = pageTitle ? `${pageTitle} | Dybala BMS` : 'Dybala BMS'

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>{fullTitle}</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%232563eb'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-size='55' font-family='sans-serif' font-weight='bold' fill='white'>D</text></svg>"
        />
      </Head>
      <AuthProvider>
        {showLayout ? (
          <Layout>
            <Component {...pageProps} />
          </Layout>
        ) : (
          <Component {...pageProps} />
        )}
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
