import { Card, CardContent } from "@/components/ui/card"
import { ImagePlaceholder } from "@/components/ui/image-placeholder"
import { Calendar, Clock, Wrench, ExternalLink, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getProjectByUsernameAndSlug } from "@/lib/projects"
import { getUserProfile } from "@/lib/profiles"
import { getThumbnailUrl } from "@/lib/utils"
import { notFound } from "next/navigation"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ username: string; projectSlug: string }>
}) {
  const { username, projectSlug } = await params
  
  // Get project data
  const projectData = await getProjectByUsernameAndSlug(username, projectSlug)
  
  if (!projectData) {
    notFound()
  }

  const { project, id } = projectData

  // Get creator profile
  const creatorProfile = await getUserProfile(username)

  // Transform thumbnail URL
  const thumbnailUrl = project.thumbnail 
    ? getThumbnailUrl(project.thumbnail, project.username)
    : ""

  // Format last updated (we'll use a placeholder since ProjectFormData doesn't have updatedAt)
  const lastUpdated = "recently"

  // Transform project data to match page expectations
  const projectDisplay = {
    id,
    title: project.title,
    slug: project.slug || projectSlug,
    description: project.description,
    thumbnail: thumbnailUrl,
    status: project.status,
    duration: project.duration,
    genre: project.genre,
    lastUpdated,
    creator: {
      name: creatorProfile?.name || username,
      username: username,
      avatar: creatorProfile?.avatar,
      bio: creatorProfile?.about || "",
    },
    links: project.links || { links: [] },
    tools: project.tools || [],
    updates: [] as Array<{ date: string; content: string }>, // ProjectFormData doesn't include updates, so we'll leave this empty for now
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
        {/* Back Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-primary mb-6 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-semibold">Back to Dashboard</span>
        </Link>

        {/* Hero Image */}
        <div className="relative h-[400px] rounded-lg overflow-hidden mb-8">
          {projectDisplay.thumbnail ? (
            <Image
              src={projectDisplay.thumbnail}
              alt={projectDisplay.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          ) : (
            <ImagePlaceholder className="h-full rounded-lg" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                {projectDisplay.status}
              </span>
              {projectDisplay.genre && (
                <span className="px-3 py-1 bg-muted/50 backdrop-blur-sm rounded-full text-sm">{projectDisplay.genre}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 text-balance">{projectDisplay.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {projectDisplay.duration}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Updated {projectDisplay.lastUpdated}
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-4">About This Project</h2>
                <p className="text-muted-foreground leading-relaxed">{projectDisplay.description}</p>
              </CardContent>
            </Card>

            {/* Tools */}
            {projectDisplay.tools.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    Tools & AI Models
                  </h2>
                  <div className="space-y-4">
                    {(['video', 'image', 'sound', 'other'] as const).map(category => {
                      const toolsInCategory = projectDisplay.tools.filter(tool => tool.category === category)
                      if (toolsInCategory.length === 0) return null
                      
                      const categoryLabels = {
                        video: "Video",
                        image: "Image",
                        sound: "Sound",
                        other: "Other"
                      }
                      
                      return (
                        <div key={category}>
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                            {categoryLabels[category]}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {toolsInCategory.map((tool, index) => (
                              <span
                                key={index}
                                className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium"
                              >
                                {tool.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Project Updates */}
            {projectDisplay.updates.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold mb-6">Project Updates</h2>
                  <div className="space-y-6">
                    {projectDisplay.updates.map((update, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="flex-shrink-0 w-2 bg-primary/20 rounded-full" />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-2">{update.date}</p>
                          <p className="leading-relaxed">{update.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Creator Info */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">Creator</h3>
                <Link href={`/${projectDisplay.creator.username}`} className="block group">
                  <div className="flex items-center gap-3 mb-3">
                    {projectDisplay.creator.avatar ? (
                      <Image
                        src={projectDisplay.creator.avatar}
                        alt={projectDisplay.creator.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover border-2 border-primary/20"
                      />
                    ) : (
                      <ImagePlaceholder variant="avatar" className="h-12 w-12" />
                    )}
                    <div>
                      <p className="font-semibold group-hover:text-primary transition-colors">{projectDisplay.creator.name}</p>
                      <p className="text-sm text-muted-foreground">@{projectDisplay.creator.username}</p>
                    </div>
                  </div>
                  {projectDisplay.creator.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{projectDisplay.creator.bio}</p>
                  )}
                </Link>
              </CardContent>
            </Card>

            {/* Links */}
            {projectDisplay.links.links.length > 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold mb-4">Links</h3>
                  <div className="space-y-2">
                    {projectDisplay.links.links.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors group"
                      >
                        <span className="text-sm font-medium">{link.label}</span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
