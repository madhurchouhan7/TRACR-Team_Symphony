import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TRACR — AI-Powered Financial Guardian',
  description:
    'Advanced artificial intelligence protecting your financial assets with real-time fraud detection, behavioral analysis, and predictive intelligence.',
  keywords: ['fraud detection', 'AML', 'AI finance', 'fintech security', 'TRACR'],
  openGraph: {
    title: 'TRACR — AI-Powered Financial Guardian',
    description: 'Real-time fraud detection powered by AI.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
