import {
  Calendar,
  Clapperboard,
  Clock,
  ExternalLink,
  FileDown,
  FileText,
  Play,
  Rss,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FilmPlayer } from "@/components/film-player";
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

// Helper functions to detect and parse video URLs
function getVideoEmbedInfo(
  url: string
): { type: "youtube" | "vimeo" | null; embedUrl: string } | null {
  try {
    // YouTube URL patterns
    const youtubeRegex =
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch?.[1]) {
      return {
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1&iv_load_policy=3`,
      };
    }

    // Vimeo URL patterns
    const vimeoRegex = /(?:vimeo\.com\/)(?:.*\/)?(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch?.[1]) {
      return {
        type: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

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
    logline: project.logline,
    slug: projectSlug,
    thumbnail: thumbnailUrl,
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
    <div className="min-h-screen bg-background pb-16">
      {/* Hero Image - Full Width */}
      <div className="relative h-[400px] xl:h-[720px] w-full mb-8">
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
          <div className="container mx-auto px-4 lg:px-8 max-w-8xl">
            <div className="flex items-center gap-3 mb-4">
              {project.isPublished && (
                <span className="px-3 py-1 bg-green-500/20 text-green-500 rounded-full text-sm font-medium">
                  Published
                </span>
              )}
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
            <div className="mt-5">
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
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 max-w-8xl">
        <div className="space-y-8">
          <div className="pb-5">
            {/* Film */}
            {project.filmLink &&
              (() => {
                const videoInfo = getVideoEmbedInfo(project.filmLink);

                if (videoInfo) {
                  // Embedded video for YouTube/Vimeo
                  return (
                    <div className="mb-5 pb-5 border-b border-border">
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                        <iframe
                          src={videoInfo.embedUrl}
                          title={`${projectDisplay.title} - Film`}
                          className="absolute inset-0 w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  );
                }

                // Fallback button for other video platforms
                return (
                  <div className="mb-5 pb-5 border-b border-border">
                    <a
                      href={project.filmLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      <span className="font-medium">Watch Film</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                );
              })()}

            {/* Logline */}
            {projectDisplay.logline && (
              <div className="pb-5 mb-5 border-b border-border">
                <p className="text-lg italic text-foreground/90 leading-relaxed">
                  "{projectDisplay.logline}"
                </p>
              </div>
            )}

            {/* About This Project */}
            {projectDisplay.logline && (
              <div className="pb-5">
                <h2 className="text-xl font-bold mb-3">About This Project</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {projectDisplay.logline}
                </p>
              </div>
            )}

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
                          {/* Character Main Image - Full Width */}
                          {character.mainImage && (
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                              <OptimizedImage
                                type="character"
                                filename={character.mainImage}
                                username={username}
                                alt={character.name || "Character"}
                                fill
                                objectFit="cover"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              />
                            </div>
                          )}

                          {/* Additional Character Images */}
                          {character.images && character.images.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {character.images.map((image, imageIndex) => (
                                <div
                                  key={`${index}-${imageIndex}`}
                                  className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30"
                                >
                                  <OptimizedImage
                                    type="character"
                                    filename={image}
                                    username={username}
                                    alt={`${character.name || "Character"} - Image ${imageIndex + 1}`}
                                    fill
                                    objectFit="cover"
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Character Info */}
                          <div>
                            <h3 className="font-semibold text-sm mb-1">
                              {character.name || "Unnamed Character"}
                            </h3>
                            {character.appearance && (
                              <p className="text-muted-foreground text-sm leading-relaxed">
                                {character.appearance}
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
            {(project.screenplayElements?.length ||
              project.screenplayText ||
              project.screenplay) && (
              <div className="pb-5 flex items-center gap-2">
                {/* View screenplay page link */}
                {(project.screenplayElements?.length || project.screenplayText) && (
                  <Link href={`/${username}/${project.slug}/screenplay`}>
                    <Button size="sm" variant="outline" className="bg-transparent text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      Read Screenplay
                    </Button>
                  </Link>
                )}
                {/* Download PDF if available */}
                {project.screenplay && (
                  <a
                    href={getProjectFileUrl(project.screenplay.filename, username)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    <Button size="sm" variant="outline" className="bg-transparent text-xs">
                      <FileDown className="h-3 w-3 mr-1" />
                      Download PDF
                    </Button>
                  </a>
                )}
              </div>
            )}

            {/* Scenes & Film Player */}
            {project.scenes && project.scenes.length > 0 && (
              <div className="mb-5 pb-5 border-b border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Clapperboard className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Scenes</h2>
                </div>

                {/* Film Player - if there are completed videos */}
                {project.scenes.some((s) =>
                  s.generatedVideos?.some((v) => v.status === "completed" && v.videoUrl)
                ) && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                      Watch the Film
                    </h3>
                    <FilmPlayer scenes={project.scenes} title={project.title} />
                  </div>
                )}

                {/* Scene List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    All Scenes ({project.scenes.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {project.scenes
                      .sort((a, b) => a.sceneNumber - b.sceneNumber)
                      .map((scene) => (
                        <Card
                          key={scene.id}
                          className="bg-muted/30 border-border hover:bg-muted/50 transition-colors"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                                {scene.sceneNumber}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{scene.title}</h4>
                                {scene.screenplay && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                    {scene.screenplay.substring(0, 80)}...
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  {scene.generatedImages && scene.generatedImages.length > 0 && (
                                    <span>{scene.generatedImages.length} images</span>
                                  )}
                                  {scene.generatedVideos && scene.generatedVideos.length > 0 && (
                                    <span>{scene.generatedVideos.length} videos</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
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
