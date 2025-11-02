import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { ArrowRight, Flame, Heart, Lightbulb, Rocket, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AboutView() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/20 via-background to-background" />

        <div className="container mx-auto px-4 lg:px-8 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-6">
              <Flame className="h-4 w-4" />
              <span>A Platform for AI Film Creators</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold mb-6 text-balance leading-tight">
              About AI Film Camp
            </h1>

            <p className="text-xl lg:text-2xl text-muted-foreground mb-10 text-balance max-w-2xl mx-auto leading-relaxed">
              A community-driven platform creators to create, collaborate, and share their
              work-in-progress AI Film projects.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-20 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">Ready to Join the Movement?</h2>
            <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
              Be part of the future of filmmaking. Start sharing your projects and connecting with
              creators today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <SignedIn>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8"
                  asChild
                >
                  <Link href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </SignedIn>
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button
                    size="lg"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </SignUpButton>
              </SignedOut>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 bg-transparent! border-primary/80! hover:border-primary/90! hover:text-white! hover:bg-primary/20!"
                asChild
              >
                <Link href="/projects">Browse Projects</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
