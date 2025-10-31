"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { X, Edit, Plus, Calendar } from "lucide-react"
import type { Post } from "@/lib/posts"
import { PostForm } from "./post-form"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { PostExport } from "./post-export"
import Image from "next/image"
import { getPostImageUrl } from "@/lib/utils"

interface PostsListProps {
  projectId: string
  initialPosts: Post[]
  canEdit?: boolean
  projectTitle?: string
  authorName?: string
}

export function PostsList({ projectId, initialPosts, canEdit = false, projectTitle, authorName }: PostsListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [showForm, setShowForm] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | undefined>(undefined)

  const handleDelete = async (postId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return
    }

    const loadingToast = toast.loading(`Deleting "${title}"...`)

    try {
      const { deletePost } = await import("@/lib/actions/posts")
      await deletePost(postId)
      
      setPosts(posts.filter((p) => p.id !== postId))
      toast.success(`"${title}" deleted successfully!`, { id: loadingToast })
    } catch (error) {
      console.error("Error deleting post:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to delete post"
      toast.error(errorMessage, { id: loadingToast })
    }
  }

  const handleFormSuccess = async () => {
    // Refresh posts
    try {
      const { getProjectPosts } = await import("@/lib/actions/posts")
      const updatedPosts = await getProjectPosts(projectId)
      setPosts(updatedPosts)
    } catch (error) {
      console.error("Error refreshing posts:", error)
    }
    
    setShowForm(false)
    setEditingPost(undefined)
  }

  const handleEdit = (post: Post) => {
    setEditingPost(post)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingPost(undefined)
  }

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
    <div className="space-y-6">
      {canEdit && (
        <div>
          {!showForm ? (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Post
            </Button>
          ) : (
            <PostForm
              projectId={projectId}
              initialPost={editingPost}
              onSuccess={handleFormSuccess}
              onCancel={handleCancel}
            />
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">No posts yet. {canEdit && "Add your first post above!"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="bg-muted/30 border-border">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{post.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(post.createdAt)}</span>
                      {post.updatedAt && post.updatedAt !== post.createdAt && (
                        <span className="text-xs">(updated {formatDate(post.updatedAt)})</span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(post)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(post.id, post.title)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <PostExport 
                    post={post} 
                    projectTitle={projectTitle}
                    authorName={authorName}
                  />
                </div>
                {post.image && post.username && (
                  <div className="mb-4 rounded-md overflow-hidden border border-border">
                    <Image
                      src={getPostImageUrl(post.image, post.username)}
                      alt={post.title}
                      width={800}
                      height={400}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert [&_.video-container]:relative [&_.video-container]:pb-[56.25%] [&_.video-container]:h-0 [&_.video-container]:overflow-hidden [&_.video-container]:my-4 [&_.video-container_iframe]:absolute [&_.video-container_iframe]:top-0 [&_.video-container_iframe]:left-0 [&_.video-container_iframe]:w-full [&_.video-container_iframe]:h-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {renderVideoEmbeds(post.content)}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

