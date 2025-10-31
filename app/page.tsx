import { Hero } from "@/components/hero"
import { FeaturedProjects } from "@/components/featured-projects"
import { CommunityFeatures } from "@/components/community-features"
import { CallToAction } from "@/components/call-to-action"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <FeaturedProjects />
      <CommunityFeatures />
      <CallToAction />
    </main>
  )
}
