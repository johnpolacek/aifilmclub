import ProjectForm from "@/components/project-form"
import { PostsList } from "@/components/posts-list"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getProject } from "@/lib/projects"
import { getPostsForProject } from "@/lib/posts"

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projectId = id

  // Get project data from S3
  const projectData = await getProject(projectId)
  
  // Get posts for this project
  const posts = await getPostsForProject(projectId)

  if (!projectData) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-primary mb-6 hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-semibold">Back to Dashboard</span>
          </Link>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground">The project you&apos;re looking for doesn&apos;t exist.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-primary mb-6 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-semibold">Back to Dashboard</span>
        </Link>

        <div className="space-y-8">
          <ProjectForm 
            initialData={projectData} 
            projectId={projectId}
            isEditing 
            redirectPath="/dashboard"
          />
          
          <div>
            <h2 className="text-2xl font-bold mb-6">Project Posts</h2>
            <PostsList 
              projectId={projectId} 
              initialPosts={posts}
              canEdit={true}
              username={projectData.username}
              projectSlug={projectData.slug}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
