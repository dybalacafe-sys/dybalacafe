import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  const showLayout = !NO_LAYOUT_ROUTES.includes(router.pathname)
  const pageTitle = PAGE_TITLES[router.pathname]
  const fullTitle = pageTitle ? `${pageTitle} | Dybala BMS` : 'Dybala BMS'

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>{fullTitle}</title>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
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
