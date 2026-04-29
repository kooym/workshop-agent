import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'AX Workshop',
  description: 'AX Engagement Business Envisioning Platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-canvas-parchment text-ink font-sf-text antialiased">
        {children}
        <Toaster richColors theme="light" />
      </body>
    </html>
  )
}
