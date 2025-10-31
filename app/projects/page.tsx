import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ImagePlaceholder } from "@/components/ui/image-placeholder"
import { Film, Clock, User } from "lucide-react"

// Placeholder projects data
const placeholderProjects = [
  {
    id: "1",
    title: "The Last Algorithm",
    description: "A sci-fi short exploring AI consciousness through the eyes of a self-aware algorithm discovering its own mortality.",
    thumbnail: "",
    creator: "filmmaker_xyz",
    status: "Completed",
    duration: "8:45",
    genre: "Sci-Fi",
    tools: [
      { name: "Runway Gen-3", category: "video" as const },
      { name: "Midjourney", category: "image" as const },
      { name: "ElevenLabs", category: "sound" as const },
    ],
  },
  {
    id: "2",
    title: "Memories in Motion",
    description: "An experimental documentary blending AI-generated visuals with real family photographs to explore themes of memory and time.",
    thumbnail: "",
    creator: "creative_soul",
    status: "In Progress",
    duration: "12:00",
    genre: "Documentary",
    tools: [
      { name: "Pika Labs", category: "video" as const },
      { name: "Stable Diffusion", category: "image" as const },
    ],
  },
  {
    id: "3",
    title: "Urban Dreams",
    description: "A visual poem capturing the essence of city life through AI-generated imagery and soundscapes.",
    thumbnail: "",
    creator: "city_artist",
    status: "Post-Production",
    duration: "5:30",
    genre: "Experimental",
    tools: [
      { name: "Runway Gen-3", category: "video" as const },
      { name: "Suno", category: "sound" as const },
    ],
  },
]

export default function ProjectsPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 text-balance">Community Projects</h1>
            <p className="text-lg lg:text-xl text-muted-foreground text-pretty">
              Explore groundbreaking AI films from creators around the world. Get inspired, learn, and collaborate.
            </p>
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {placeholderProjects.map((project) => (
              <Card
                key={project.id}
                className="bg-card border-border overflow-hidden hover:border-primary/50 transition-all group cursor-pointer"
              >
                <div className="relative h-48 bg-muted">
                  {project.thumbnail && project.thumbnail !== "/placeholder.svg" ? (
                    <img
                      src={project.thumbnail}
                      alt={project.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImagePlaceholder className="h-full" />
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                      {project.status}
                    </Badge>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 text-balance group-hover:text-primary transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-3">
                    {project.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {project.creator}
                    </div>
                    {project.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {project.duration}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.tools.slice(0, 3).map((tool, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tool.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Empty State / Coming Soon Message */}
          <div className="text-center mt-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Film className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">More Projects Coming Soon</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              This is just a preview. Join the community and share your own AI film projects!
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

