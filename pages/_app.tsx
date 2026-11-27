import { useState } from 'react'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/AuthContext'
import Layout from '@/components/Layout'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'

const NO_LAYOUT_ROUTES = ['/login', '/setup']

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

  return (
    <QueryClientProvider client={queryClient}>
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
