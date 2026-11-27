import Link from 'next/link'

export default function Custom404() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-extrabold text-blue-600">404</p>
      <h1 className="mt-3 text-2xl font-bold text-gray-900">Page Not Found</h1>
      <p className="mt-2 text-sm text-gray-500 max-w-md">
        The page you are looking for does not exist or is not available for the selected outlet.
      </p>
      <Link href="/dashboard" className="mt-6 btn-primary">
        Back to Dashboard
      </Link>
    </div>
  )
}
