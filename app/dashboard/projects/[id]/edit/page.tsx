import type { Metadata } from "next"
import { getProject } from "@/lib/projects"
import { getPostsForProject } from "@/lib/posts"
import { EditProjectView } from "@/components/views/edit-project-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const projectData = await getProject(id)
  
  return {
    title: projectData ? `Edit ${projectData.title} - AI Film Camp` : "Edit Project - AI Film Camp",
    description: "Edit your AI film project",
  }
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projectId = id

  // Get project data from S3
  const projectData = await getProject(projectId)
  
  // Get posts for this project
  const posts = await getPostsForProject(projectId)

  return (
    <EditProjectView
      projectData={projectData}
      projectId={projectId}
      posts={posts}
      username={projectData?.username || ""}
      projectSlug={projectData?.slug || ""}
    />
  )
}
