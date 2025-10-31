import type React from "react"
import type { Metadata } from "next"
import { Rethink_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { Toaster } from "@/components/ui/sonner"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

const rethink_sans = Rethink_Sans({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AI Film Camp - Community for AI Film Creators",
  description:
    "Join the online community for AI film creators to share projects, collaborate, and showcase work-in-progress.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${rethink_sans.className} font-sans antialiased`}>
        <ClerkProvider>
          <Header />
          {children}
          <Footer />
          <Toaster />
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  )
}
