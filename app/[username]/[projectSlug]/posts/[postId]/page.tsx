import { Card, CardContent } from "@/components/ui/card"
import { ImagePlaceholder } from "@/components/ui/image-placeholder"
import { Calendar, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getPost } from "@/lib/posts"
import { getProject } from "@/lib/projects"
import { getUserProfile } from "@/lib/profiles"
import { getPostImageUrl } from "@/lib/utils"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"

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
  const project = await getProject(post.projectId)
  
  if (!project || project.username !== username || project.slug !== projectSlug) {
    notFound()
  }

  // Get creator profile
  const creatorProfile = await getUserProfile(username)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const renderVideoEmbeds = (content: string): string => {
    // Replace [youtube:VIDEO_ID] with HTML embed
    content = content.replace(
      /\[youtube:([^\]]+)\]/g,
      '<div class="video-container"><iframe width="100%" height="315" src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'
    )
    
    // Replace [vimeo:VIDEO_ID] with HTML embed
    content = content.replace(
      /\[vimeo:([^\]]+)\]/g,
      '<div class="video-container"><iframe src="https://player.vimeo.com/video/$1" width="100%" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>'
    )
    
    return content
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
        {/* Back Button */}
        <Link
          href={`/${username}/${projectSlug}`}
          className="inline-flex items-center gap-2 text-primary mb-6 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-semibold">Back to Project</span>
        </Link>

        <Card className="bg-muted/30 border-border">
          <CardContent className="p-6">
            <div className="mb-6">
              {/* Project Link */}
              <Link
                href={`/${username}/${projectSlug}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors mb-4 inline-block"
              >
                {project.title}
              </Link>
              
              {/* Post Title */}
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
              
              {/* Post Meta */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  {creatorProfile?.avatar ? (
                    <Image
                      src={creatorProfile.avatar}
                      alt={creatorProfile.name || username}
                      width={24}
                      height={24}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <ImagePlaceholder variant="avatar" className="h-6 w-6" />
                  )}
                  <span className="font-medium">{creatorProfile?.name || username}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(post.createdAt)}</span>
                  {post.updatedAt && post.updatedAt !== post.createdAt && (
                    <span className="text-xs ml-1">(updated {formatDate(post.updatedAt)})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Post Image */}
            {post.image && post.username && (
              <div className="mb-6 rounded-md overflow-hidden border border-border">
                <Image
                  src={getPostImageUrl(post.image, post.username)}
                  alt={post.title}
                  width={800}
                  height={400}
                  className="w-full h-auto object-contain"
                />
              </div>
            )}

            {/* Post Content */}
            <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_.video-container]:relative [&_.video-container]:pb-[56.25%] [&_.video-container]:h-0 [&_.video-container]:overflow-hidden [&_.video-container]:my-4 [&_.video-container_iframe]:absolute [&_.video-container_iframe]:top-0 [&_.video-container_iframe]:left-0 [&_.video-container_iframe]:w-full [&_.video-container_iframe]:h-full">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {renderVideoEmbeds(post.content)}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

