import { Calendar, Film, Play, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { getAllProjects } from "@/lib/projects";
import { getThumbnailUrl } from "@/lib/utils";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function FilmsPage() {
  const allProjects = await getAllProjects();
  
  // Filter to only published films
  const publishedFilms = Object.entries(allProjects)
    .filter(([_, project]) => project.isPublished)
    .map(([id, project]) => ({ id, ...project }))
    .sort((a, b) => {
      // Sort by publishedAt date, newest first
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Film className="h-10 w-10 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold">Open Source Films</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore AI-generated films created by our community. View the source, learn from the process, and get inspired.
          </p>
        </div>

        {/* Films Grid */}
        {publishedFilms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedFilms.map((film) => {
              const thumbnailUrl = film.thumbnail && film.username
                ? getThumbnailUrl(film.thumbnail, film.username)
                : null;
              
              const hasCompletedVideos = film.scenes?.some((s) =>
                s.generatedVideos?.some((v) => v.status === "completed" && v.videoUrl)
              );

              return (
                <Link
                  key={film.id}
                  href={`/${film.username}/${film.slug}`}
                  className="group"
                >
                  <Card className="bg-card border-border overflow-hidden hover:border-primary/50 transition-colors">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-muted">
                      {thumbnailUrl ? (
                        <Image
                          src={thumbnailUrl}
                          alt={film.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <ImagePlaceholder className="h-full w-full" />
                      )}
                      
                      {/* Play overlay */}
                      {hasCompletedVideos && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                            <Play className="h-7 w-7 text-black ml-0.5" />
                          </div>
                        </div>
                      )}

                      {/* Genre badge */}
                      {film.genre && (
                        <div className="absolute top-3 left-3">
                          <span className="px-2 py-1 bg-black/60 backdrop-blur-sm text-white rounded text-xs font-medium">
                            {film.genre}
                          </span>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
                        {film.title}
                      </h3>
                      
                      {film.logline && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {film.logline}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{film.username}</span>
                        </div>
                        
                        {film.publishedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(film.publishedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      {film.scenes && film.scenes.length > 0 && (
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                          <span>{film.scenes.length} scenes</span>
                          {film.scenes.reduce((sum, s) => sum + (s.generatedImages?.length || 0), 0) > 0 && (
                            <span>
                              {film.scenes.reduce((sum, s) => sum + (s.generatedImages?.length || 0), 0)} images
                            </span>
                          )}
                          {film.scenes.reduce((sum, s) => sum + (s.generatedVideos?.length || 0), 0) > 0 && (
                            <span>
                              {film.scenes.reduce((sum, s) => sum + (s.generatedVideos?.length || 0), 0)} videos
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Film className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-semibold mb-2">No Films Yet</h2>
            <p className="text-muted-foreground mb-6">
              Be the first to publish an open source AI film!
            </p>
            <Link
              href="/dashboard/projects/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <Film className="h-5 w-5" />
              Create a Film
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}


