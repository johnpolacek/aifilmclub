import { Button } from "@/components/ui/button"
import { ArrowRight, Flame } from "lucide-react"
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs"
import Link from "next/link"

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/20 via-background to-background" />

      <div className="container mx-auto px-4 lg:px-8 relative">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-6">
            <Flame className="h-4 w-4" />
            <span>Where AI meets cinema</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-bold mb-6 text-balance leading-tight">
            Create. Share. Collaborate.
          </h1>

          <p className="text-xl lg:text-2xl text-muted-foreground mb-10 text-pretty max-w-4xl mx-auto leading-relaxed">
            A platform-agnostic, curated online community for AI film creators. Share your work-in-progress, get feedback, and
            discover groundbreaking projects.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignedIn>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8" asChild>
                <Link href="/dashboard">
                  Start Creating
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </SignedIn>
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8">
                  Start Creating
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>
            </SignedOut>
            <Button size="lg" variant="outline" className="text-base px-8 bg-transparent! border-primary/80! hover:border-primary/90! hover:text-white! hover:bg-primary/20!" asChild>
              <Link href="/projects">
                Explore Projects
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
