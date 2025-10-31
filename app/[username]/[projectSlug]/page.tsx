import type { Metadata } from "next"
import { getProjectByUsernameAndSlug } from "@/lib/projects"
import { getUserProfile } from "@/lib/profiles"
import { getPostsForProject } from "@/lib/posts"
import { notFound } from "next/navigation"
import { ProjectView } from "@/components/views/project-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; projectSlug: string }>
}): Promise<Metadata> {
  const { username, projectSlug } = await params
  const projectData = await getProjectByUsernameAndSlug(username, projectSlug)
  
  if (!projectData) {
    return {
      title: "Project Not Found - AI Film Camp",
    }
  }

  const { project } = projectData

  return {
    title: `${project.title} - ${username} - AI Film Camp`,
    description: project.description || `View ${project.title} by ${username} on AI Film Camp`,
  }
}

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

  // TypeScript assertion: projectData is non-null after the check above
  const { project, id } = projectData as NonNullable<typeof projectData>

  // Get creator profile
  const creatorProfile = await getUserProfile(username)
  
  // Get posts for this project
  const posts = await getPostsForProject(id)

  return (
    <ProjectView
      projectId={id}
      project={{ ...project, slug: projectSlug }}
      username={username}
      projectSlug={projectSlug}
      creatorProfile={creatorProfile}
      posts={posts}
    />
  )
}
