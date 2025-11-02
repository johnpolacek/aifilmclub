import { Calendar, Clock, ExternalLink, FileDown, Rss } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PostsList } from "@/components/posts-list";
import type { ProjectFormData } from "@/components/project-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { ProjectNavigation } from "@/components/views/project-navigation";
import type { Post } from "@/lib/posts";
import type { UserProfile } from "@/lib/profiles";
import { getProjectFileUrl, getThumbnailUrl } from "@/lib/utils";

interface ProjectViewProps {
  projectId: string;
  project: ProjectFormData & { slug: string };
  username: string;
  projectSlug: string;
  creatorProfile: UserProfile | null;
  posts: Post[];
}

export function ProjectView({
  projectId,
  project,
  username,
  projectSlug,
  creatorProfile,
  posts,
}: ProjectViewProps) {
  // Transform thumbnail URL
  const thumbnailUrl = project.thumbnail ? getThumbnailUrl(project.thumbnail, username) : "";

  // Format last updated (we'll use a placeholder since ProjectFormData doesn't have updatedAt)
  const lastUpdated = "recently";

  // Transform project data to match page expectations
  const projectDisplay = {
    id: projectId,
    title: project.title,
    slug: projectSlug,
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
    updates: [] as Array<{ date: string; content: string }>,
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      {/* Hero Image - Full Width */}
      <div className="relative h-[400px] xl:h-[500px] w-full mb-8">
        <ProjectNavigation projectId={projectId} ownerUsername={username} />
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
          <ImagePlaceholder className="h-full w-full" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                {projectDisplay.status}
              </span>
              {projectDisplay.genre && (
                <span className="px-3 py-1 bg-muted/50 backdrop-blur-sm rounded-full text-sm">
                  {projectDisplay.genre}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 text-balance">
              {projectDisplay.title}
            </h1>
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
      </div>

      <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
        <div className="space-y-8">
          {/* Combined Project Info */}
          <div className="pb-5">
            {/* Creator */}
            <div className="mb-5">
              <Link
                href={`/${projectDisplay.creator.username}`}
                className="inline-flex items-center gap-2 group"
              >
                {projectDisplay.creator.avatar ? (
                  <Image
                    src={projectDisplay.creator.avatar}
                    alt={projectDisplay.creator.name}
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <ImagePlaceholder variant="avatar" className="h-6 w-6" />
                )}
                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                  {projectDisplay.creator.name}
                </span>
              </Link>
            </div>

            {/* About This Project */}
            <div className="mb-5 pb-5 border-b border-border">
              <h2 className="text-xl font-bold mb-3">About This Project</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {projectDisplay.description}
              </p>
            </div>

            {/* Characters */}
            {project.characters && project.characters.length > 0 && (
              <div className="mb-5 pb-5 border-b border-border">
                <h2 className="text-xl font-bold mb-4">Characters</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.characters.map((character, index) => (
                    <Card
                      key={`character-${character.name}-${index}`}
                      className="bg-muted/30 border-border"
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Character Image - Full Width */}
                          {character.image && (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                              <OptimizedImage
                                type="character"
                                filename={character.image}
                                username={username}
                                alt={character.name || "Character"}
                                fill
                                objectFit="cover"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              />
                            </div>
                          )}

                          {/* Character Info */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm">
                                {character.name || "Unnamed Character"}
                              </h3>
                              {character.type && (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                                  {character.type}
                                </span>
                              )}
                            </div>
                            {character.description && (
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {character.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Setting - Locations */}
            {project.setting?.locations && project.setting.locations.length > 0 && (
              <div className="mb-5 pb-5 border-b border-border">
                <h2 className="text-xl font-bold mb-4">Setting</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.setting.locations.map((location, index) => (
                    <Card
                      key={`location-${location.name}-${index}`}
                      className="bg-muted/30 border-border"
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Location Image - Full Width (if exists) */}
                          {location.image && (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                              <OptimizedImage
                                type="location"
                                filename={location.image}
                                username={username}
                                alt={location.name || "Location"}
                                fill
                                objectFit="cover"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              />
                            </div>
                          )}

                          {/* Location Info */}
                          <div>
                            <h3 className="font-semibold mb-1 text-sm">
                              {location.name || "Unnamed Location"}
                            </h3>
                            {location.description && (
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {location.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Screenplay / Script */}
            {(project.screenplay || project.files?.[0]) && (
              <div className="pb-5">
                {(() => {
                  // Support both new screenplay field and old files array for backwards compatibility
                  const screenplay = project.screenplay || project.files?.[0];
                  if (!screenplay) return null;

                  const fileUrl = getProjectFileUrl(screenplay.filename, username);
                  return (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download>
                      <Button size="sm" variant="outline" className="bg-transparent text-xs">
                        <FileDown className="h-3 w-3 mr-1" />
                        View Screenplay
                      </Button>
                    </a>
                  );
                })()}
              </div>
            )}

            {/* Tools */}
            {projectDisplay.tools.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Tools
                </h2>
                <div className="flex flex-wrap gap-2">
                  {projectDisplay.tools.map((tool, index) => (
                    <span
                      key={`tool-${tool.name}-${tool.category}-${index}`}
                      className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Project Posts */}
          {posts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Project Posts</h2>
                <a
                  href={`/api/rss/${username}/${projectSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Rss className="h-4 w-4" />
                  RSS Feed
                </a>
              </div>
              <PostsList
                projectId={projectId}
                initialPosts={posts}
                canEdit={false}
                projectTitle={project.title}
                authorName={creatorProfile?.name || username}
                username={username}
                projectSlug={projectSlug}
              />
            </div>
          )}

          {/* Project Updates */}
          {projectDisplay.updates.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold mb-6">Project Updates</h2>
                <div className="space-y-6">
                  {projectDisplay.updates.map((update, index) => (
                    <div key={`update-${update.date}-${index}`} className="flex gap-4">
                      <div className="shrink-0 w-2 bg-primary/20 rounded-full" />
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

          {/* Links */}
          {projectDisplay.links.links.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">Links</h3>
                <div className="space-y-2">
                  {projectDisplay.links.links.map((link, index) => (
                    <a
                      key={`${link.label}-${link.url}-${index}`}
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
  );
}
