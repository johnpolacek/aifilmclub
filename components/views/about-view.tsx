import { Button } from "@/components/ui/button"
import { ArrowRight, Flame, Users, Lightbulb, Rocket, Heart } from "lucide-react"
import Link from "next/link"
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs"

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
              A community-driven platform creators to create, collaborate, and share their work-in-progress AI Film projects.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-center">Our Mission</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 leading-relaxed">
              AI Film Camp exists to democratize filmmaking and foster a vibrant community where creators can learn, 
              share, and push the boundaries of what&apos;s possible with AI-powered tools. We believe that everyone has 
              a story to tell, and AI can help bring those stories to life.
            </p>
          </div>

          {/* Values Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto mt-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Community First</h3>
              <p className="text-muted-foreground">
                Connect with fellow creators, share feedback, and grow together.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Lightbulb className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Innovation</h3>
              <p className="text-muted-foreground">
                Explore cutting-edge AI tools and techniques for filmmaking.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Empowerment</h3>
              <p className="text-muted-foreground">
                Provide the tools and resources to bring your vision to life.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Passion</h3>
              <p className="text-muted-foreground">
                Celebrate the art of storytelling and creative expression.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold mb-12 text-center">What We Offer</h2>
            
            <div className="space-y-8">
              <div className="bg-background/60 backdrop-blur-sm border border-border/40 rounded-lg p-6 lg:p-8">
                <h3 className="text-2xl font-semibold mb-3">Project Showcase</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Share your work-in-progress and completed projects with a supportive community. Get constructive 
                  feedback, discover new techniques, and find inspiration from fellow creators.
                </p>
              </div>

              <div className="bg-background/60 backdrop-blur-sm border border-border/40 rounded-lg p-6 lg:p-8">
                <h3 className="text-2xl font-semibold mb-3">Learning Resources</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Access curated tutorials, guides, and resources to master AI filmmaking tools. From beginners 
                  to advanced creators, we have content to help you level up your skills.
                </p>
              </div>

              <div className="bg-background/60 backdrop-blur-sm border border-border/40 rounded-lg p-6 lg:p-8">
                <h3 className="text-2xl font-semibold mb-3">Collaborative Environment</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Connect with other filmmakers, form teams, and collaborate on projects. Share insights, 
                  exchange ideas, and build lasting relationships within the AI filmmaking community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Ready to Join the Movement?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
              Be part of the future of filmmaking. Start sharing your projects and connecting with creators today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <SignedIn>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8" asChild>
                  <Link href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </SignedIn>
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </SignUpButton>
              </SignedOut>
              <Button size="lg" variant="outline" className="text-base px-8 bg-transparent! border-primary/80! hover:border-primary/90! hover:text-white! hover:bg-primary/20!" asChild>
                <Link href="/projects">
                  Browse Projects
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

