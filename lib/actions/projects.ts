"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectFormData } from "@/components/project-form";
import { deleteProject as deleteProjectFromS3, getProject, saveProject } from "@/lib/projects";

/**
 * Get the username from the current Clerk user
 */
async function getCurrentUsername(): Promise<string> {
  const user = await currentUser();

  if (!user) {
    throw new Error("User not found");
  }

  // Use Clerk username or email prefix as username
  return user.username || user.emailAddresses[0]?.emailAddress.split("@")[0] || user.id;
}

/**
 * Create a new project
 */
export async function createProject(data: ProjectFormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to create a project");
  }

  try {
    // Generate a unique project ID (slug or UUID)
    const projectId = data.slug || `project-${Date.now()}`;

    // Add username to project data if not already set
    if (!data.username) {
      data.username = await getCurrentUsername();
    }

    // Save to S3
    await saveProject(projectId, data);

    // Revalidate the dashboard page
    revalidatePath("/dashboard");

    return { success: true, projectId };
  } catch (error) {
    console.error("Error creating project:", error);
    throw new Error("Failed to create project");
  }
}

/**
 * Update an existing project
 */
export async function updateProject(projectId: string, data: ProjectFormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to update a project");
  }

  try {
    // Check if project exists and user owns it
    const existingProject = await getProject(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    // Check if user owns the project
    const currentUsername = await getCurrentUsername();
    if (existingProject.username !== currentUsername) {
      throw new Error("You don't have permission to update this project");
    }

    // Save to S3
    await saveProject(projectId, data);

    // Revalidate the dashboard and edit pages
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/projects/${projectId}/edit`);

    return { success: true };
  } catch (error) {
    console.error("Error updating project:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to update project");
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to delete a project");
  }

  try {
    // Check if project exists and user owns it
    const existingProject = await getProject(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    // Check if user owns the project
    const currentUsername = await getCurrentUsername();
    if (existingProject.username !== currentUsername) {
      throw new Error("You don't have permission to delete this project");
    }

    // Delete from S3
    await deleteProjectFromS3(projectId);

    // Revalidate the dashboard page
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to delete project");
  }
}

/**
 * Publish a project (make it publicly shareable)
 */
export async function publishProject(projectId: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to publish a project");
  }

  try {
    // Check if project exists and user owns it
    const existingProject = await getProject(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    // Check if user owns the project
    const currentUsername = await getCurrentUsername();
    if (existingProject.username !== currentUsername) {
      throw new Error("You don't have permission to publish this project");
    }

    // Update project with published status
    const updatedProject = {
      ...existingProject,
      isPublished: true,
      publishedAt: new Date().toISOString(),
    };

    await saveProject(projectId, updatedProject);

    // Revalidate pages
    revalidatePath("/dashboard");
    revalidatePath(`/${currentUsername}/${existingProject.slug}`);
    revalidatePath("/films");

    return { success: true };
  } catch (error) {
    console.error("Error publishing project:", JSON.stringify({ projectId, error }, null, 2));
    throw new Error(error instanceof Error ? error.message : "Failed to publish project");
  }
}

/**
 * Unpublish a project
 */
export async function unpublishProject(projectId: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to unpublish a project");
  }

  try {
    // Check if project exists and user owns it
    const existingProject = await getProject(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    // Check if user owns the project
    const currentUsername = await getCurrentUsername();
    if (existingProject.username !== currentUsername) {
      throw new Error("You don't have permission to unpublish this project");
    }

    // Update project with unpublished status
    const updatedProject = {
      ...existingProject,
      isPublished: false,
    };

    await saveProject(projectId, updatedProject);

    // Revalidate pages
    revalidatePath("/dashboard");
    revalidatePath(`/${currentUsername}/${existingProject.slug}`);
    revalidatePath("/films");

    return { success: true };
  } catch (error) {
    console.error("Error unpublishing project:", JSON.stringify({ projectId, error }, null, 2));
    throw new Error(error instanceof Error ? error.message : "Failed to unpublish project");
  }
}

/**
 * Upload a project thumbnail image
 */
export async function uploadProjectThumbnail(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to upload a thumbnail");
  }

  try {
    const username = await getCurrentUsername();
    const file = formData.get("image") as File;

    if (!file) {
      throw new Error("No image file provided");
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    // Validate file size (max 10MB for thumbnails)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error("Image must be less than 10MB");
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique filename (timestamp only)
    const timestamp = Date.now();
    const filename = `${timestamp}.jpg`;
    const key = `thumbnails/${username}/${filename}`;

    // Upload optimized image to S3
    const { uploadImageFromBuffer } = await import("@/lib/s3");
    await uploadImageFromBuffer(buffer, key, file.type, { isThumbnail: true });

    // Revalidate pages that show project data
    revalidatePath("/dashboard");

    // Return just the filename (not the full key or URL) - URL will be constructed when displaying
    return { success: true, thumbnailFilename: filename };
  } catch (error) {
    console.error("Error uploading project thumbnail:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload thumbnail");
  }
}

/**
 * Upload a character image
 */
export async function uploadCharacterImage(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to upload a character image");
  }

  try {
    const username = await getCurrentUsername();
    const file = formData.get("image") as File;

    if (!file) {
      throw new Error("No image file provided");
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    // Validate file size (max 10MB for character images)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error("Image must be less than 10MB");
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique filename (timestamp + random to avoid collisions)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const filename = `${timestamp}-${random}.jpg`;
    const key = `characters/${username}/${filename}`;

    // Upload optimized image to S3 (maintains original aspect ratio)
    const { uploadImageFromBuffer } = await import("@/lib/s3");
    await uploadImageFromBuffer(buffer, key, file.type);

    // Revalidate pages that show project data
    revalidatePath("/dashboard");

    // Return just the filename (not the full key or URL) - URL will be constructed when displaying
    return { success: true, imageFilename: filename };
  } catch (error) {
    console.error("Error uploading character image:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload character image");
  }
}

/**
 * Upload a location image
 */
export async function uploadLocationImage(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to upload a location image");
  }

  try {
    const username = await getCurrentUsername();
    const file = formData.get("image") as File;

    if (!file) {
      throw new Error("No image file provided");
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    // Validate file size (max 10MB for location images)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error("Image must be less than 10MB");
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique filename (timestamp + random to avoid collisions)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const filename = `${timestamp}-${random}.jpg`;
    const key = `locations/${username}/${filename}`;

    // Upload optimized image to S3 (using thumbnail optimization for location images)
    const { uploadImageFromBuffer } = await import("@/lib/s3");
    await uploadImageFromBuffer(buffer, key, file.type, { isThumbnail: true });

    // Revalidate pages that show project data
    revalidatePath("/dashboard");

    // Return just the filename (not the full key or URL) - URL will be constructed when displaying
    return { success: true, imageFilename: filename };
  } catch (error) {
    console.error("Error uploading location image:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload location image");
  }
}

/**
 * Upload a project file (PDF, documents, etc.)
 */
export async function uploadProjectFile(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to upload a file");
  }

  try {
    const username = await getCurrentUsername();
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file size (max 50MB for project files)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error("File must be less than 50MB");
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique filename (timestamp + original filename sanitized)
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_"); // Sanitize filename
    const filename = `${timestamp}-${originalName}`;
    const key = `projects/${username}/files/${filename}`;

    // Upload file to S3
    const { uploadFileFromBuffer } = await import("@/lib/s3");
    await uploadFileFromBuffer(buffer, key, file.type || "application/octet-stream");

    // Revalidate pages that show project data
    revalidatePath("/dashboard");

    // Return filename and metadata
    return {
      success: true,
      filename: filename,
      originalName: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    };
  } catch (error) {
    console.error("Error uploading project file:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload file");
  }
}

/**
 * Submit project form (create or update based on context)
 */
export async function submitProjectForm(
  data: ProjectFormData,
  projectId?: string,
  redirectPath: string = "/dashboard",
  skipRedirect: boolean = false
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to submit a project");
  }

  try {
    if (projectId) {
      // Update existing project
      await updateProject(projectId, data);
    } else {
      // Create new project
      await createProject(data);
    }

    // Skip redirect for auto-save
    if (skipRedirect) {
      return { success: true };
    }

    // Redirect to success page
    redirect(redirectPath);
  } catch (error) {
    // Check if this is a Next.js redirect error - if so, re-throw it
    if (error && typeof error === "object" && "digest" in error) {
      const errorDigest = String(error.digest || "");
      if (errorDigest.includes("NEXT_REDIRECT")) {
        throw error; // Re-throw redirect errors to let Next.js handle them
      }
    }

    console.error("Error submitting project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save project",
    };
  }
}
