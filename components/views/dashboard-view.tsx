"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ImagePlaceholder } from "@/components/ui/image-placeholder"
import { Edit, X, Eye, Calendar, Clock } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import type { ProjectFormData } from "@/components/project-form"
import { getThumbnailUrl } from "@/lib/utils"

type DashboardView = ProjectFormData & {
  id: string
  lastUpdated?: string
}

interface DashboardViewProps {
  initialProjects: DashboardView[]
}

export function DashboardView({ initialProjects }: DashboardViewProps) {
  const [projects, setProjects] = useState<DashboardView[]>(initialProjects)

  const handleDeleteProject = async (id: string, title: string) => {
    if (!confirm("Are you sure you want to delete this project?")) {
      return
    }

    // Show loading toast
    const loadingToast = toast.loading(`Deleting "${title}"...`)

    try {
      // Import and call the Server Action
      const { deleteProject } = await import("@/lib/actions/projects")
      await deleteProject(id)
      
      // Remove from local state
      setProjects(projects.filter((p) => p.id !== id))
      
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

  return (
    <div className="grid gap-6">
      {projects.map((project) => (
        <Card key={project.id} className="bg-muted/30 border-border overflow-hidden">
          <div className="grid md:grid-cols-[200px_1fr] gap-4">
            <div className="relative h-48 md:h-auto pl-4">
              {project.thumbnail ? (
                <Image
                  src={getThumbnailUrl(project.thumbnail, project.username)}
                  alt={project.title}
                  fill
                  className="object-cover rounded"
                  sizes="(max-width: 768px) 100vw, 200px"
                />
              ) : (
                <ImagePlaceholder className="h-full rounded" />
              )}
            </div>
            <div className="px-4 flex flex-col justify-between">
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
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {project.username && project.slug && (
                  <Link href={`/${project.username}/${project.slug}`} className="flex-1">
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </Link>
                )}
                <Link href={`/dashboard/projects/${project.id}/edit`}>
                  <Button size="sm" variant="outline">
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteProject(project.id, project.title)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

