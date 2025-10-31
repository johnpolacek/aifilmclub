"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { X, Edit, Plus, Calendar } from "lucide-react"
import type { Post } from "@/lib/posts"
import { PostForm } from "./post-form"

interface PostsListProps {
  projectId: string
  initialPosts: Post[]
  canEdit?: boolean
}

export function PostsList({ projectId, initialPosts, canEdit = false }: PostsListProps) {
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
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

