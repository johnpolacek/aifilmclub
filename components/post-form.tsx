"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, Plus, Edit } from "lucide-react"
import type { Post } from "@/lib/posts"

interface PostFormProps {
  projectId: string
  initialPost?: Post
  onSuccess?: () => void
  onCancel?: () => void
}

export function PostForm({ projectId, initialPost, onSuccess, onCancel }: PostFormProps) {
  const [title, setTitle] = useState(initialPost?.title || "")
  const [content, setContent] = useState(initialPost?.content || "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in both title and content")
      return
    }

    setIsSubmitting(true)
    const loadingToast = toast.loading(initialPost ? "Updating post..." : "Creating post...")

    try {
      const { createPost, updatePost } = await import("@/lib/actions/posts")

      if (initialPost) {
        await updatePost(initialPost.id, { title, content })
        toast.success("Post updated successfully!", { id: loadingToast })
      } else {
        await createPost(projectId, { title, content })
        toast.success("Post created successfully!", { id: loadingToast })
      }

      // Reset form
      setTitle("")
      setContent("")

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error saving post:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save post"
      toast.error(errorMessage, { id: loadingToast })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="bg-muted/30 border-border">
      <CardHeader>
        <CardTitle className="text-lg">
          {initialPost ? "Edit Post" : "Add New Post"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              disabled={isSubmitting}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="post-content">Content</Label>
            <Textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post content here..."
              rows={6}
              disabled={isSubmitting}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {initialPost ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Post
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </>
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

