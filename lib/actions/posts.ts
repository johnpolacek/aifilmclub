"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { savePost, deletePost as deletePostFromS3, getPost, getPostsForProject } from "@/lib/posts"
import type { Post } from "@/lib/posts"

/**
 * Get the username from the current Clerk user
 */
async function getCurrentUsername(): Promise<string> {
  const user = await currentUser()
  
  if (!user) {
    throw new Error("User not found")
  }

  // Use Clerk username or email prefix as username
  return user.username || user.emailAddresses[0]?.emailAddress.split("@")[0] || user.id
}

/**
 * Create a new post
 */
export async function createPost(projectId: string, data: { title: string; content: string }) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("You must be signed in to create a post")
  }

  try {
    const username = await getCurrentUsername()
    
    // Generate a unique post ID
    const postId = `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    
    const now = new Date().toISOString()
    
    const postData: Post = {
      id: postId,
      projectId,
      title: data.title,
      content: data.content,
      createdAt: now,
      updatedAt: now,
      username,
    }

    // Save to S3
    await savePost(postId, postData)

    // Revalidate relevant pages
    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}/edit`)

    return { success: true, postId }
  } catch (error) {
    console.error("Error creating post:", error)
    throw new Error("Failed to create post")
  }
}

/**
 * Update an existing post
 */
export async function updatePost(postId: string, data: { title: string; content: string }) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("You must be signed in to update a post")
  }

  try {
    // Check if post exists and user owns it
    const existingPost = await getPost(postId)
    if (!existingPost) {
      throw new Error("Post not found")
    }

    // Check if user owns the post
    const currentUsername = await getCurrentUsername()
    if (existingPost.username !== currentUsername) {
      throw new Error("You don't have permission to update this post")
    }

    // Update post data
    const updatedPost: Post = {
      ...existingPost,
      title: data.title,
      content: data.content,
      updatedAt: new Date().toISOString(),
    }

    // Save to S3
    await savePost(postId, updatedPost)

    // Revalidate relevant pages
    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${existingPost.projectId}/edit`)

    return { success: true }
  } catch (error) {
    console.error("Error updating post:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to update post")
  }
}

/**
 * Delete a post
 */
export async function deletePost(postId: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("You must be signed in to delete a post")
  }

  try {
    // Check if post exists and user owns it
    const existingPost = await getPost(postId)
    if (!existingPost) {
      throw new Error("Post not found")
    }

    // Check if user owns the post
    const currentUsername = await getCurrentUsername()
    if (existingPost.username !== currentUsername) {
      throw new Error("You don't have permission to delete this post")
    }

    const projectId = existingPost.projectId

    // Delete from S3
    await deletePostFromS3(postId)

    // Revalidate relevant pages
    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/projects/${projectId}/edit`)

    return { success: true }
  } catch (error) {
    console.error("Error deleting post:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to delete post")
  }
}

/**
 * Get all posts for a project
 */
export async function getProjectPosts(projectId: string): Promise<Post[]> {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("You must be signed in to view posts")
  }

  try {
    return await getPostsForProject(projectId)
  } catch (error) {
    console.error("Error getting project posts:", error)
    return []
  }
}

