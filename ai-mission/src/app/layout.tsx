import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import AuthHeader from '@/components/AuthHeader'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'FounderCheck — India-AI Mission',
  description: 'AI-powered founder screening for the ITEL incubation program',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`} suppressHydrationWarning>
        <ClerkProvider
          dynamic
          appearance={{
            layout: {
              logoPlacement: "none",
              showOptionalFields: false,
              socialButtonsPlacement: "bottom",
              socialButtonsVariant: "iconButton",
            },
            elements: {
              footer: "hidden", // This hides the "Secured by Clerk" and "Development mode" footer
              headerTitle: "Sign in to FounderCheck",
              headerSubtitle: "Welcome back! Please sign in to continue",
              dividerRow: "hidden"
            }
          }}
        >
          <AuthHeader />
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}