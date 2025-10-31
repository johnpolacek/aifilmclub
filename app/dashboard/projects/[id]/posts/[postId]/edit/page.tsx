import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { PostForm } from "@/components/post-form"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getPost } from "@/lib/posts"
import { getProject } from "@/lib/projects"

export default async function EditPostPage({ 
  params 
}: { 
  params: Promise<{ id: string; postId: string }> 
}) {
  const { userId } = await auth()
  
  if (!userId) {
    redirect("/signin")
  }

  const { id: projectId, postId } = await params

  // Verify project exists and user has access
  const project = await getProject(projectId)
  
  if (!project) {
    redirect("/dashboard")
  }

  // Get post data
  const post = await getPost(postId)
  
  if (!post || post.projectId !== projectId) {
    redirect("/dashboard")
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

        <PostForm 
          projectId={projectId}
          initialPost={post}
          redirectPath="/dashboard"
        />
      </div>
    </div>
  )
}

