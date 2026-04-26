import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Workshop Agent',
  description: 'Business envisioning workshop facilitation tool',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen bg-neutral-950 text-white antialiased">
        {children}
        <Toaster richColors theme="dark" />
      </body>
    </html>
  )
}
