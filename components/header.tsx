import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Flame } from "lucide-react"
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <Flame className="h-6 w-6 text-primary" />
            <span className="text-balance">AI Film Camp</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Projects
            </Link>
            <Link href="/resources" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Resources
            </Link>
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <SignedIn>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex hover:bg-primary/20! hover:text-white!" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="outline" className="bg-transparent! border-primary/80! hover:border-primary/90! hover:text-white! hover:bg-primary/20!" size="sm">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="bg-primary text-white hover:text-white">
                  Join
                </Button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </header>
  )
}
