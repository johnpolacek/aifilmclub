"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ImagePlaceholder } from "@/components/ui/image-placeholder"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Edit, X, Eye, Calendar, Clock, MessageSquare } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import type { ProjectFormData } from "@/components/project-form"
import type { Post } from "@/lib/posts"
import { getThumbnailUrl } from "@/lib/utils"

type DashboardView = ProjectFormData & {
  id: string
  lastUpdated?: string
}

interface DashboardViewProps {
  initialProjects: DashboardView[]
  initialPostsByProject?: Record<string, Post[]>
}

export function DashboardView({ initialProjects, initialPostsByProject = {} }: DashboardViewProps) {
  const [projects, setProjects] = useState<DashboardView[]>(initialProjects)
  const [visiblePostsCount, setVisiblePostsCount] = useState<Record<string, number>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<Record<string, boolean>>({})
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string } | null>(null)

  const handleDeleteProject = async (id: string, title: string) => {
    // Show loading toast
    const loadingToast = toast.loading(`Deleting "${title}"...`)

    try {
      // Import and call the Server Action
      const { deleteProject } = await import("@/lib/actions/projects")
      await deleteProject(id)
      
      // Remove from local state
      setProjects(projects.filter((p) => p.id !== id))
      
      // Close dialog
      setDeleteDialogOpen({ ...deleteDialogOpen, [id]: false })
      setProjectToDelete(null)
      
      // Show success toast
      toast.success(`"${title}" deleted successfully!`, {
        id: loadingToast,
      })
    } catch (error) {
      console.error("Error deleting project:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete project. Please try again."
      
      // Show error toast
      toast.error(errorMessage, {
        id: loadingToast,
      })
    }
  }

  const openDeleteDialog = (id: string, title: string) => {
    setProjectToDelete({ id, title })
    setDeleteDialogOpen({ ...deleteDialogOpen, [id]: true })
  }

  const closeDeleteDialog = (id: string) => {
    setDeleteDialogOpen({ ...deleteDialogOpen, [id]: false })
    setProjectToDelete(null)
  }

  const showMorePosts = (projectId: string) => {
    setVisiblePostsCount({ ...visiblePostsCount, [projectId]: (visiblePostsCount[projectId] || 1) + 3 })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="grid gap-6">
      {projects.map((project) => {
        const posts = initialPostsByProject[project.id] || []
        const visibleCount = visiblePostsCount[project.id] || 1
        const visiblePosts = posts.slice(0, visibleCount)
        const hasMorePosts = visibleCount < posts.length

        return (
          <Card key={project.id} className="bg-muted/30 border-border overflow-hidden">
            <div className="grid grid-cols-2 gap-4 p-4">
              {/* Left: Image */}
              <div className="relative aspect-video">
                {project.thumbnail ? (
                  <Image
                    src={getThumbnailUrl(project.thumbnail, project.username)}
                    alt={project.title}
                    fill
                    className="object-cover rounded"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <ImagePlaceholder className="h-full rounded" />
                )}
              </div>
              
              {/* Right: Project Info */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">{project.title}</h3>
                    <Badge variant="secondary" className="bg-sky-800 font-mono uppercase text-white/50! font-bold -mt-2 text-xxs">
                      {project.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {project.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    {project.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {project.duration}
                      </div>
                    )}
                    {project.lastUpdated && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Updated {project.lastUpdated}
                      </div>
                    )}
                    {posts.length > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between gap-2 mt-4">
                  <div className="flex gap-2">
                    <Link href={`/dashboard/projects/${project.id}/posts/new`}>
                      <Button size="sm" variant="default">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        New Post
                      </Button>
                    </Link>
                    {project.username && project.slug && (
                      <Link href={`/${project.username}/${project.slug}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>
                    )}
                    <Link href={`/dashboard/projects/${project.id}/edit`}>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDeleteDialog(project.id, project.title)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Posts Section - Full Width */}
              <div className="col-span-2">
                {posts.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">No posts yet. Create your first post to get started!</p>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-2">
                      {visiblePosts.map((post) => (
                        <div key={post.id} className="p-3 bg-background/50 rounded border border-border">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-semibold text-sm">{post.title}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</span>
                              <Link href={`/dashboard/projects/${project.id}/posts/${post.id}/edit`}>
                                <Button size="sm" variant="outline" className="text-xs gap-2 px-2! py-1! h-auto">
                                  <Edit className="h-3 w-3" /> Edit
                                </Button>
                              </Link>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{post.content}</p>
                        </div>
                      ))}
                    </div>
                    {hasMorePosts && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => showMorePosts(project.id)}
                          className="w-full"
                        >
                          Show {Math.min(3, posts.length - visibleCount)} More {posts.length - visibleCount === 1 ? 'Post' : 'Posts'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen[project.id] || false} onOpenChange={(open) => !open && closeDeleteDialog(project.id)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Project</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &ldquo;{project.title}&rdquo;? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => closeDeleteDialog(project.id)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => projectToDelete && handleDeleteProject(projectToDelete.id, projectToDelete.title)}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Card>
        )
      })}
    </div>
  )
}

