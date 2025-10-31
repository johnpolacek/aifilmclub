import type { Metadata } from "next"
import { getPost, type Post } from "@/lib/posts"
import { getProject } from "@/lib/projects"
import { getUserProfile } from "@/lib/profiles"
import { notFound } from "next/navigation"
import { PostView } from "@/components/views/post-view"
import type { ProjectFormData } from "@/components/project-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; projectSlug: string; postId: string }>
}): Promise<Metadata> {
  const { username, projectSlug, postId } = await params
  const post = await getPost(postId)
  
  if (!post) {
    return {
      title: "Post Not Found - AI Film Camp",
    }
  }

  const project = await getProject(post.projectId)
  
  if (!project || project.username !== username || project.slug !== projectSlug) {
    return {
      title: "Post Not Found - AI Film Camp",
    }
  }

  return {
    title: `${post.title} - ${project.title} - AI Film Camp`,
    description: post.content.substring(0, 160) || `Read ${post.title} by ${username}`,
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ username: string; projectSlug: string; postId: string }>
}) {
  const { username, projectSlug, postId } = await params
  
  // Get post data
  const post = await getPost(postId)
  
  if (!post) {
    notFound()
  }

  // Verify the post belongs to a project with matching username and slug
  const project = await getProject(post!.projectId)
  
  if (!project || project.username !== username || project.slug !== projectSlug) {
    notFound()
  }

  // Get creator profile
  const creatorProfile = await getUserProfile(username)

  return (
    <PostView
      post={post!}
      project={{ ...project, username } as ProjectFormData & { username: string }}
      creatorProfile={creatorProfile}
      username={username}
      projectSlug={projectSlug}
    />
  )
}

