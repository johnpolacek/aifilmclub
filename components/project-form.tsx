"use client";

import {
  Camera,
  Clapperboard,
  Cloud,
  CloudOff,
  File,
  Film,
  LinkIcon,
  Loader2,
  Pencil,
  Plus,
  Upload,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { SceneList } from "@/components/scene-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePreview } from "@/components/ui/image-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getImageUrl } from "@/lib/image-utils";
import type { Scene } from "@/lib/scenes";

// Types
export interface ProjectLinks {
  links: Array<{ label: string; url: string }>;
}

export type ToolCategory = "image" | "video" | "sound" | "other";

export interface CategorizedTool {
  name: string;
  category: ToolCategory;
}

export interface Character {
  name: string;
  appearance: string;
  mainImage?: string; // Main character image filename
  images?: string[]; // Additional images for different angles/attire
}

export interface Location {
  name: string;
  description: string;
  image?: string; // filename only
}

export interface ProjectFile {
  name: string; // Display name (e.g., "Screenplay.pdf")
  filename: string; // S3 filename (e.g., "1761873619145-screenplay.pdf")
  size?: number; // File size in bytes
  type?: string; // MIME type (e.g., "application/pdf")
}

export interface ProjectFormData {
  title: string;
  logline: string; // One-line description of the film
  duration: string;
  genre: string;
  characters?: Character[];
  setting?: {
    locations?: Location[];
  };
  scenes?: Scene[]; // Film scenes with generated content
  screenplayText?: string; // Full screenplay text content
  thumbnail?: string;
  filmLink?: string; // YouTube or Vimeo link
  links: ProjectLinks;
  tools: CategorizedTool[];
  screenplay?: ProjectFile;
  username?: string;
  slug?: string;
  publishedAt?: string; // When the film was published
  isPublished?: boolean; // Whether the film is published/shared publicly
}

// Common tools by category
const COMMON_TOOLS = {
  image: [
    "Midjourney",
    "DALL-E",
    "Stable Diffusion",
    "Leonardo AI",
    "Ideogram",
    "Flux",
    "Adobe Firefly",
    "Other",
  ],
  video: [
    "Runway Gen-3",
    "Google Veo",
    "Pika Labs",
    "Kling AI",
    "Midjourney",
    "Luma Dream Machine",
    "HaiperAI",
    "Sora",
    "Other",
  ],
  sound: ["ElevenLabs", "Suno", "Udio", "Mubert", "AIVA", "Soundraw", "Other"],
  other: [
    "Adobe After Effects",
    "Adobe Premiere Pro",
    "Adobe Photoshop",
    "Adobe Illustrator",
    "DaVinci Resolve",
    "Final Cut Pro",
    "Avid Media Composer",
    "Blender",
    "Cinema 4D",
    "Maya",
    "Adobe Audition",
    "Pro Tools",
    "Logic Pro",
    "Ableton Live",
    "Other",
  ],
} as const;

// Helper function to infer label from URL
function inferLabelFromUrl(url: string): string {
  const urlLower = url.toLowerCase();

  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) return "YouTube";
  if (urlLower.includes("vimeo.com")) return "Vimeo";
  if (urlLower.includes("x.com") || urlLower.includes("twitter.com")) return "X (Twitter)";
  if (urlLower.includes("instagram.com")) return "Instagram";
  if (urlLower.includes("tiktok.com")) return "TikTok";
  if (urlLower.includes("facebook.com")) return "Facebook";
  if (urlLower.includes("linkedin.com")) return "LinkedIn";

  // For other URLs, try to extract domain name
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return "Website";
  }
}

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  projectId?: string;
  isEditing?: boolean;
  redirectPath?: string;
}

export default function ProjectForm({
  initialData,
  projectId,
  isEditing = false,
  redirectPath = "/dashboard",
}: ProjectFormProps) {
  const router = useRouter();
  const genreSelectId = useId();
  const durationSelectId = useId();

  const [formData, setFormData] = useState<ProjectFormData>({
    title: initialData?.title || "",
    logline: initialData?.logline || "",
    duration: initialData?.duration || "",
    genre: initialData?.genre || "",
    characters: initialData?.characters || [],
    setting: initialData?.setting || { locations: [] },
    scenes: initialData?.scenes || [],
    screenplayText: initialData?.screenplayText || "",
    thumbnail: initialData?.thumbnail,
    filmLink: initialData?.filmLink || "",
    links: initialData?.links || { links: [] },
    tools: initialData?.tools || [],
    screenplay: initialData?.screenplay,
    username: initialData?.username,
    slug: initialData?.slug,
  });

  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [selectedTool, setSelectedTool] = useState<Record<ToolCategory, string>>({
    video: "",
    image: "",
    sound: "",
    other: "",
  });
  const [customToolInput, setCustomToolInput] = useState<Record<ToolCategory, string>>({
    video: "",
    image: "",
    sound: "",
    other: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const characterFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const characterAdditionalFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const characterAddImageInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [uploadingCharacterIndex, setUploadingCharacterIndex] = useState<number | null>(null);
  const [uploadingCharacterAdditionalIndex, setUploadingCharacterAdditionalIndex] = useState<{
    characterIndex: number;
    imageIndex: number;
  } | null>(null);
  const [characterPreviewImages, setCharacterPreviewImages] = useState<Record<number, string>>({});
  const [characterAdditionalPreviewImages, setCharacterAdditionalPreviewImages] = useState<
    Record<number, Record<number, string>>
  >({});
  const [hasVideoTool, setHasVideoTool] = useState(() => {
    const tools = initialData?.tools || [];
    return tools.some((tool) => tool.category === "video");
  });
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [editingCharacterIndex, setEditingCharacterIndex] = useState<number | null>(null);
  const [isEditingProjectInfo, setIsEditingProjectInfo] = useState(!isEditing); // Start expanded for new projects

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const isInitialMount = useRef(true);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>(JSON.stringify(formData));

  // Auto-save function (only for editing existing projects)
  const autoSave = useCallback(async () => {
    if (!isEditing || !projectId) return;

    // Don't auto-save if currently submitting or uploading
    if (isSubmitting || isUploadingImage || uploadingCharacterIndex !== null) return;

    setAutoSaveStatus("saving");

    try {
      const { submitProjectForm } = await import("@/lib/actions/projects");
      const result = await submitProjectForm(formData, projectId, undefined, true); // true = skipRedirect

      if (result && !result.success) {
        throw new Error(result.error || "Failed to auto-save");
      }

      lastSavedDataRef.current = JSON.stringify(formData);
      setAutoSaveStatus("saved");

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setAutoSaveStatus("idle");
      }, 3000);
    } catch (error) {
      // Ignore redirect errors (shouldn't happen with skipRedirect)
      if (error && typeof error === "object" && "digest" in error) {
        const errorDigest = String((error as { digest?: string }).digest || "");
        if (errorDigest.includes("NEXT_REDIRECT")) {
          lastSavedDataRef.current = JSON.stringify(formData);
          setAutoSaveStatus("saved");
          return;
        }
      }

      console.error("Auto-save error:", error);
      setAutoSaveStatus("error");

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setAutoSaveStatus("idle");
      }, 5000);
    }
  }, [formData, isEditing, projectId, isSubmitting, isUploadingImage, uploadingCharacterIndex]);

  // Auto-save effect with debounce
  useEffect(() => {
    // Skip auto-save on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only auto-save when editing existing projects
    if (!isEditing || !projectId) return;

    // Check if data has actually changed
    const currentData = JSON.stringify(formData);
    if (currentData === lastSavedDataRef.current) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Debounce: wait 2 seconds after last change before saving
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, isEditing, projectId, autoSave]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one video tool is added
    if (!hasVideoTool) {
      toast.error("Please add at least one Video Generation tool");
      return;
    }

    setIsSubmitting(true);

    // Show loading toast
    const loadingToast = toast.loading(isEditing ? "Updating project..." : "Creating project...");

    try {
      // Generate slug for new projects
      if (!isEditing && formData.title) {
        const slug = formData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        formData.slug = slug;
      }

      // Import and call the Server Action
      const { submitProjectForm } = await import("@/lib/actions/projects");

      // This will handle both create and update, plus authentication
      const result = await submitProjectForm(formData, projectId, redirectPath);

      // If there's an error result (not a redirect), show it
      if (result && !result.success) {
        throw new Error(result.error || "Failed to save project");
      }

      // Dismiss loading and show success
      toast.success(isEditing ? "Project updated successfully!" : "Project created successfully!", {
        id: loadingToast,
      });

      // If we get here and didn't redirect, navigate manually
      // (though submitProjectForm should redirect on success)
      router.push(redirectPath);
    } catch (error) {
      // Check if this is a Next.js redirect error - if so, let it propagate
      if (error && typeof error === "object" && "digest" in error) {
        const errorDigest = String(error.digest || "");
        if (errorDigest.includes("NEXT_REDIRECT")) {
          // Re-throw redirect errors to let Next.js handle them
          // Don't reset submitting state here as redirect will navigate away
          throw error;
        }
      }

      console.error("Error submitting project:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save project. Please try again.";

      // Dismiss loading and show error
      toast.error(errorMessage, {
        id: loadingToast,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(redirectPath);
  };

  const addLink = () => {
    if (newLinkUrl.trim()) {
      const label = inferLabelFromUrl(newLinkUrl);
      setFormData({
        ...formData,
        links: {
          links: [...formData.links.links, { label, url: newLinkUrl.trim() }],
        },
      });
      setNewLinkUrl("");
    }
  };

  const removeLink = (index: number) => {
    setFormData({
      ...formData,
      links: {
        links: formData.links.links.filter((_, i) => i !== index),
      },
    });
  };

  const addTool = (category: ToolCategory, toolName?: string) => {
    const nameToAdd =
      toolName ||
      (selectedTool[category] === "Other"
        ? customToolInput[category].trim()
        : selectedTool[category]);

    if (nameToAdd) {
      const newTools = [...formData.tools, { name: nameToAdd, category }];
      setFormData({
        ...formData,
        tools: newTools,
      });

      // Reset the inputs
      if (selectedTool[category] === "Other") {
        setCustomToolInput({ ...customToolInput, [category]: "" });
      }
      setSelectedTool({ ...selectedTool, [category]: "" });

      // Update video tool tracker
      if (category === "video") {
        setHasVideoTool(true);
      }
    }
  };

  const removeTool = (index: number) => {
    const toolToRemove = formData.tools[index];
    const newTools = formData.tools.filter((_, i) => i !== index);

    setFormData({
      ...formData,
      tools: newTools,
    });

    // Update video tool tracker if we removed a video tool
    if (toolToRemove.category === "video") {
      setHasVideoTool(newTools.some((tool) => tool.category === "video"));
    }
  };

  const getToolsByCategory = (category: ToolCategory) => {
    return formData.tools.filter((tool) => tool.category === category);
  };

  const getCategoryLabel = (category: ToolCategory): string => {
    const labels = {
      image: "Image Generation",
      video: "Video Generation",
      sound: "Sound Generation",
      other: "Multimedia",
    };
    return labels[category];
  };

  const addCharacter = () => {
    const newCharacters = [...(formData.characters || []), { name: "", appearance: "" }];
    setFormData({
      ...formData,
      characters: newCharacters,
    });
  };

  const removeCharacter = (index: number) => {
    const newCharacters = formData.characters?.filter((_, i) => i !== index) || [];
    setFormData({
      ...formData,
      characters: newCharacters,
    });
    // Clean up preview images and refs
    const newPreviews = { ...characterPreviewImages };
    delete newPreviews[index];
    setCharacterPreviewImages(newPreviews);

    const newAdditionalPreviews = { ...characterAdditionalPreviewImages };
    delete newAdditionalPreviews[index];
    setCharacterAdditionalPreviewImages(newAdditionalPreviews);
  };

  const updateCharacter = (index: number, field: keyof Character, value: string | string[]) => {
    const newCharacters = [...(formData.characters || [])];
    newCharacters[index] = { ...newCharacters[index], [field]: value };
    setFormData({
      ...formData,
      characters: newCharacters,
    });
  };

  const handleCharacterMainImageClick = (index: number) => {
    characterFileInputRefs.current[index]?.click();
  };

  const handleCharacterMainImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate raw file size (max 20MB - we'll compress it)
    const maxRawSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxRawSize) {
      toast.error("Image must be less than 20MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setCharacterPreviewImages({
        ...characterPreviewImages,
        [index]: reader.result as string,
      });
    };
    reader.readAsDataURL(file);

    // Compress and upload image
    setUploadingCharacterIndex(index);
    const loadingToast = toast.loading("Compressing image...");

    try {
      // Compress image client-side (maintain original aspect ratio, max 3840x3840 to accommodate any orientation)
      const compressedFile = await compressImage(file, 3840, 3840, 0.85);

      // Validate compressed size (max 2MB)
      const maxCompressedSize = 2 * 1024 * 1024; // 2MB
      if (compressedFile.size > maxCompressedSize) {
        toast.error("Compressed image is still too large. Please try a smaller image.", {
          id: loadingToast,
        });
        setUploadingCharacterIndex(null);
        return;
      }

      toast.loading("Uploading character image...", { id: loadingToast });

      const { uploadCharacterImage } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("image", compressedFile);

      const result = await uploadCharacterImage(uploadFormData);

      if (result.success && result.imageFilename) {
        const newCharacters = [...(formData.characters || [])];
        newCharacters[index] = { ...newCharacters[index], mainImage: result.imageFilename };
        setFormData({
          ...formData,
          characters: newCharacters,
        });
        setCharacterPreviewImages({
          ...characterPreviewImages,
          [index]: "",
        });
        toast.success("Character image uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading character image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload character image";
      toast.error(errorMessage, {
        id: loadingToast,
      });
      setCharacterPreviewImages({
        ...characterPreviewImages,
        [index]: "",
      });
    } finally {
      setUploadingCharacterIndex(null);
      // Reset file input
      const fileInput = characterFileInputRefs.current[index];
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };

  const handleCharacterAdditionalImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    characterIndex: number,
    imageIndex: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate raw file size (max 20MB - we'll compress it)
    const maxRawSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxRawSize) {
      toast.error("Image must be less than 20MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setCharacterAdditionalPreviewImages({
        ...characterAdditionalPreviewImages,
        [characterIndex]: {
          ...characterAdditionalPreviewImages[characterIndex],
          [imageIndex]: reader.result as string,
        },
      });
    };
    reader.readAsDataURL(file);

    // Compress and upload image
    setUploadingCharacterAdditionalIndex({ characterIndex, imageIndex });
    const loadingToast = toast.loading("Compressing image...");

    try {
      // Compress image client-side (maintain original aspect ratio, max 3840x3840 to accommodate any orientation)
      const compressedFile = await compressImage(file, 3840, 3840, 0.85);

      // Validate compressed size (max 2MB)
      const maxCompressedSize = 2 * 1024 * 1024; // 2MB
      if (compressedFile.size > maxCompressedSize) {
        toast.error("Compressed image is still too large. Please try a smaller image.", {
          id: loadingToast,
        });
        setUploadingCharacterAdditionalIndex(null);
        return;
      }

      toast.loading("Uploading character image...", { id: loadingToast });

      const { uploadCharacterImage } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("image", compressedFile);

      const result = await uploadCharacterImage(uploadFormData);

      if (result.success && result.imageFilename) {
        const newCharacters = [...(formData.characters || [])];
        const currentImages = newCharacters[characterIndex].images || [];
        const newImages = [...currentImages];
        newImages[imageIndex] = result.imageFilename;
        newCharacters[characterIndex] = {
          ...newCharacters[characterIndex],
          images: newImages,
        };
        setFormData({
          ...formData,
          characters: newCharacters,
        });
        const newPreviews = { ...characterAdditionalPreviewImages };
        if (newPreviews[characterIndex]) {
          delete newPreviews[characterIndex][imageIndex];
        }
        setCharacterAdditionalPreviewImages(newPreviews);
        toast.success("Character image uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading character image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload character image";
      toast.error(errorMessage, {
        id: loadingToast,
      });
      const newPreviews = { ...characterAdditionalPreviewImages };
      if (newPreviews[characterIndex]) {
        delete newPreviews[characterIndex][imageIndex];
      }
      setCharacterAdditionalPreviewImages(newPreviews);
    } finally {
      setUploadingCharacterAdditionalIndex(null);
      // Reset file input
      const fileInput = characterAdditionalFileInputRefs.current[`${characterIndex}-${imageIndex}`];
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };

  const handleCharacterAdditionalImageClick = (characterIndex: number, imageIndex: number) => {
    characterAdditionalFileInputRefs.current[`${characterIndex}-${imageIndex}`]?.click();
  };

  const handleAddCharacterAdditionalImageClick = (characterIndex: number) => {
    characterAddImageInputRefs.current[characterIndex]?.click();
  };

  const handleAddCharacterAdditionalImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    characterIndex: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate raw file size (max 20MB - we'll compress it)
    const maxRawSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxRawSize) {
      toast.error("Image must be less than 20MB");
      return;
    }

    // Get the next image index
    const currentImages = formData.characters?.[characterIndex]?.images || [];
    const imageIndex = currentImages.length;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setCharacterAdditionalPreviewImages({
        ...characterAdditionalPreviewImages,
        [characterIndex]: {
          ...characterAdditionalPreviewImages[characterIndex],
          [imageIndex]: reader.result as string,
        },
      });
    };
    reader.readAsDataURL(file);

    // Compress and upload image
    setUploadingCharacterAdditionalIndex({ characterIndex, imageIndex });
    const loadingToast = toast.loading("Compressing image...");

    try {
      // Compress image client-side (maintain original aspect ratio, max 3840x3840 to accommodate any orientation)
      const compressedFile = await compressImage(file, 3840, 3840, 0.85);

      // Validate compressed size (max 2MB)
      const maxCompressedSize = 2 * 1024 * 1024; // 2MB
      if (compressedFile.size > maxCompressedSize) {
        toast.error("Compressed image is still too large. Please try a smaller image.", {
          id: loadingToast,
        });
        setUploadingCharacterAdditionalIndex(null);
        return;
      }

      toast.loading("Uploading character image...", { id: loadingToast });

      const { uploadCharacterImage } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("image", compressedFile);

      const result = await uploadCharacterImage(uploadFormData);

      if (result.success && result.imageFilename) {
        const newCharacters = [...(formData.characters || [])];
        const currentImages = newCharacters[characterIndex].images || [];
        newCharacters[characterIndex] = {
          ...newCharacters[characterIndex],
          images: [...currentImages, result.imageFilename],
        };
        setFormData({
          ...formData,
          characters: newCharacters,
        });
        const newPreviews = { ...characterAdditionalPreviewImages };
        if (newPreviews[characterIndex]) {
          delete newPreviews[characterIndex][imageIndex];
        }
        setCharacterAdditionalPreviewImages(newPreviews);
        toast.success("Character image uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading character image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload character image";
      toast.error(errorMessage, {
        id: loadingToast,
      });
      const newPreviews = { ...characterAdditionalPreviewImages };
      if (newPreviews[characterIndex]) {
        delete newPreviews[characterIndex][imageIndex];
      }
      setCharacterAdditionalPreviewImages(newPreviews);
    } finally {
      setUploadingCharacterAdditionalIndex(null);
      // Reset file input
      const fileInput = characterAddImageInputRefs.current[characterIndex];
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };

  const removeCharacterAdditionalImage = (characterIndex: number, imageIndex: number) => {
    const newCharacters = [...(formData.characters || [])];
    const currentImages = newCharacters[characterIndex].images || [];
    newCharacters[characterIndex] = {
      ...newCharacters[characterIndex],
      images: currentImages.filter((_, i) => i !== imageIndex),
    };
    setFormData({
      ...formData,
      characters: newCharacters,
    });
    // Clean up preview
    const newPreviews = { ...characterAdditionalPreviewImages };
    if (newPreviews[characterIndex]) {
      const currentPreviews = { ...newPreviews[characterIndex] };
      delete currentPreviews[imageIndex];
      // Reindex remaining previews
      const reindexed: Record<number, string> = {};
      Object.keys(currentPreviews).forEach((key) => {
        const oldIndex = Number(key);
        if (oldIndex < imageIndex) {
          reindexed[oldIndex] = currentPreviews[oldIndex];
        } else if (oldIndex > imageIndex) {
          reindexed[oldIndex - 1] = currentPreviews[oldIndex];
        }
      });
      newPreviews[characterIndex] = reindexed;
    }
    setCharacterAdditionalPreviewImages(newPreviews);
  };

  const handleProjectFileClick = () => {
    projectFileInputRef.current?.click();
  };

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF only)
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error("File must be less than 50MB");
      return;
    }

    setIsUploadingFile(true);
    const loadingToast = toast.loading("Uploading screenplay...");

    try {
      const { uploadProjectFile } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const result = await uploadProjectFile(uploadFormData);

      if (result.success && result.filename) {
        setFormData({
          ...formData,
          screenplay: {
            name: result.originalName,
            filename: result.filename,
            size: result.size,
            type: result.type,
          },
        });
        toast.success("Screenplay uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading screenplay:", JSON.stringify(error, null, 2));
      const errorMessage = error instanceof Error ? error.message : "Failed to upload screenplay";
      toast.error(errorMessage, {
        id: loadingToast,
      });
    } finally {
      setIsUploadingFile(false);
      // Reset file input
      if (projectFileInputRef.current) {
        projectFileInputRef.current.value = "";
      }
    }
  };

  const removeScreenplay = () => {
    setFormData({
      ...formData,
      screenplay: undefined,
    });
  };

  // Compress image client-side before upload
  const compressImage = (
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.85,
    targetAspect?: number
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.onload = () => {
          // Calculate new dimensions maintaining aspect ratio
          let width = img.width;
          let height = img.height;

          // Resize if needed
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            if (width > height) {
              width = Math.min(width, maxWidth);
              height = width / aspectRatio;
            } else {
              height = Math.min(height, maxHeight);
              width = height * aspectRatio;
            }
          }

          // Crop to target aspect ratio if provided
          if (targetAspect !== undefined) {
            const currentAspect = width / height;

            if (Math.abs(currentAspect - targetAspect) > 0.01) {
              if (currentAspect > targetAspect) {
                // Image is wider, crop horizontally
                width = height * targetAspect;
              } else {
                // Image is taller, crop vertically
                height = width / targetAspect;
              }
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob and then to File
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"));
                return;
              }

              // Create a new File with compressed data
              const compressedFile = new globalThis.File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate raw file size (max 20MB - we'll compress it)
    const maxRawSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxRawSize) {
      toast.error("Image must be less than 20MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Compress and upload image
    setIsUploadingImage(true);
    const loadingToast = toast.loading("Compressing image...");

    try {
      // Compress image client-side (16:9 aspect ratio, max 1920x1080)
      const compressedFile = await compressImage(file, 1920, 1080, 0.85, 16 / 9);

      // Validate compressed size (max 2MB - should be well under this after compression)
      const maxCompressedSize = 2 * 1024 * 1024; // 2MB
      if (compressedFile.size > maxCompressedSize) {
        toast.error("Compressed image is still too large. Please try a smaller image.", {
          id: loadingToast,
        });
        setIsUploadingImage(false);
        return;
      }

      toast.loading("Uploading thumbnail...", { id: loadingToast });

      const { uploadProjectThumbnail } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("image", compressedFile);

      const result = await uploadProjectThumbnail(uploadFormData);

      if (result.success && result.thumbnailFilename) {
        setFormData({
          ...formData,
          thumbnail: result.thumbnailFilename,
        });
        setPreviewImage(null);
        toast.success("Thumbnail uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload thumbnail";
      toast.error(errorMessage, {
        id: loadingToast,
      });
      setPreviewImage(null);
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              {isEditing ? "Edit Project" : "Create New Project"}
            </CardTitle>
            {isEditing && (
              <div className="flex items-center gap-2 text-sm">
                {autoSaveStatus === "saving" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Saving...</span>
                  </>
                )}
                {autoSaveStatus === "saved" && (
                  <>
                    <Cloud className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">Saved</span>
                  </>
                )}
                {autoSaveStatus === "error" && (
                  <>
                    <CloudOff className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Save failed</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Info Section */}
          {!isEditingProjectInfo ? (
            /* Compact Project Info View */
            <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border border-border bg-muted/30">
              {/* Thumbnail */}
              <div className="w-full sm:w-48 md:w-64 shrink-0">
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                  {formData.thumbnail && formData.username ? (
                    <OptimizedImage
                      type="thumbnail"
                      filename={formData.thumbnail}
                      username={formData.username}
                      alt="Project image"
                      fill
                      objectFit="cover"
                      sizes="256px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-semibold truncate">
                      {formData.title || "Untitled Project"}
                    </h3>
                    {formData.logline && (
                      <p className="text-muted-foreground line-clamp-2">{formData.logline}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProjectInfo(true)}
                    className="shrink-0 bg-transparent"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.genre && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                      {formData.genre}
                    </span>
                  )}
                  {formData.duration && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                      {formData.duration}
                    </span>
                  )}
                </div>
                {formData.filmLink && (
                  <p className="text-xs text-muted-foreground truncate">
                    <LinkIcon className="h-3 w-3 inline mr-1" />
                    {formData.filmLink}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Expanded Project Info Edit Form */
            <div className="space-y-6 p-4 rounded-lg border border-border bg-muted/10">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Project Info</h3>
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProjectInfo(false)}
                    className="bg-transparent"
                  >
                    Done
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter your project title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="bg-background"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logline">Logline</Label>
                    <Input
                      id="logline"
                      placeholder="A one-sentence summary of your film's story"
                      value={formData.logline || ""}
                      onChange={(e) => setFormData({ ...formData, logline: e.target.value })}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                      A brief, compelling description of your film in 1-2 sentences
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="genre">Genre</Label>
                      <Select
                        value={formData.genre}
                        onValueChange={(value) => setFormData({ ...formData, genre: value })}
                      >
                        <SelectTrigger className="w-full bg-background" id={genreSelectId}>
                          <SelectValue placeholder="Select genre..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Action">Action</SelectItem>
                          <SelectItem value="Animation">Animation</SelectItem>
                          <SelectItem value="Comedy">Comedy</SelectItem>
                          <SelectItem value="Documentary">Documentary</SelectItem>
                          <SelectItem value="Drama">Drama</SelectItem>
                          <SelectItem value="Fantasy">Fantasy</SelectItem>
                          <SelectItem value="Horror">Horror</SelectItem>
                          <SelectItem value="Romance">Romance</SelectItem>
                          <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                          <SelectItem value="Thriller">Thriller</SelectItem>
                          <SelectItem value="Experimental">Experimental</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Select
                        value={formData.duration}
                        onValueChange={(value) => setFormData({ ...formData, duration: value })}
                      >
                        <SelectTrigger className="w-full bg-background" id={durationSelectId}>
                          <SelectValue placeholder="Select duration..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Short (< 5 min)">Short (&lt; 5 min)</SelectItem>
                          <SelectItem value="Medium (5-20 min)">Medium (5-20 min)</SelectItem>
                          <SelectItem value="Long (20-50 min)">Long (20-60 min)</SelectItem>
                          <SelectItem value="Feature (60+ min)">Feature (60+ min)</SelectItem>
                          <SelectItem value="Series/Episode">Series / Episodic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filmLink">Film Link</Label>
                    <Input
                      id="filmLink"
                      placeholder="YouTube or Vimeo URL (e.g., https://youtube.com/watch?v=...)"
                      value={formData.filmLink || ""}
                      onChange={(e) => setFormData({ ...formData, filmLink: e.target.value })}
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                      Add a link to your film on YouTube or Vimeo
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thumbnail">Project Image</Label>
                  <div className="space-y-4">
                    {/* Thumbnail Preview */}
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                      {previewImage ? (
                        <ImagePreview
                          src={previewImage}
                          isUploading={isUploadingImage}
                          isUploaded={!!formData.thumbnail}
                          alt="Project image"
                          aspectRatio="video"
                          objectFit="cover"
                        />
                      ) : formData.thumbnail && formData.username ? (
                        <OptimizedImage
                          type="thumbnail"
                          filename={formData.thumbnail}
                          username={formData.username}
                          alt="Project image"
                          fill
                          objectFit="cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : null}
                      {/* Upload overlay */}
                      <button
                        type="button"
                        onClick={handleImageClick}
                        disabled={isUploadingImage}
                        className="group absolute inset-0 flex items-center justify-center bg-black/60 opacity-50 hover:opacity-100 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
                        aria-label="Upload project image"
                      >
                        {isUploadingImage ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Camera className="h-8 w-8 text-white" />
                            <span className="text-sm text-white font-medium">
                              {formData.thumbnail ? "Change Image" : "Upload Image"}
                            </span>
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Upload Button */}
                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleImageClick}
                        disabled={isUploadingImage}
                        className="bg-transparent"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {isUploadingImage
                          ? "Uploading..."
                          : formData.thumbnail
                            ? "Change Image"
                            : "Upload Image"}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {formData.thumbnail ? "Image uploaded" : "No image selected"}
                      </span>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={isUploadingImage}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Characters Section */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Characters</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add characters to your project with images, names, and appearance details
            </p>

            <div className="space-y-4">
              {/* Character Grid - Compact View */}
              {(formData.characters || []).length > 0 && editingCharacterIndex === null && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {(formData.characters || []).map((character, index) => (
                    <div
                      key={`character-compact-${index}`}
                      className="relative group rounded-lg overflow-hidden border border-border bg-muted/30"
                    >
                      {/* Character Image */}
                      <div className="aspect-square relative">
                        {character.mainImage && formData.username ? (
                          <OptimizedImage
                            type="character"
                            filename={character.mainImage}
                            username={formData.username}
                            alt={character.name || "Character"}
                            fill
                            objectFit="cover"
                            className="w-full h-full"
                            sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 12.5vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <User className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        {/* Hover overlay with edit button */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingCharacterIndex(index)}
                            className="h-7 w-7 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => removeCharacter(index)}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Character Name */}
                      <div className="p-1.5 text-center">
                        <p className="text-xs font-medium truncate">
                          {character.name || "Unnamed"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Character Edit Form - Expanded View */}
              {editingCharacterIndex !== null && formData.characters?.[editingCharacterIndex] && (
                <Card className="bg-muted/30 border-border">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Edit Character</h4>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingCharacterIndex(null)}
                          className="bg-transparent"
                        >
                          Done
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            removeCharacter(editingCharacterIndex);
                            setEditingCharacterIndex(null);
                          }}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Character Name */}
                    <div className="space-y-2">
                      <Label htmlFor={`character-name-${editingCharacterIndex}`}>Name</Label>
                      <Input
                        id={`character-name-${editingCharacterIndex}`}
                        placeholder="Enter character name"
                        value={formData.characters[editingCharacterIndex].name}
                        onChange={(e) =>
                          updateCharacter(editingCharacterIndex, "name", e.target.value)
                        }
                        className="bg-background"
                      />
                    </div>

                    {/* Character Main Image */}
                    <div className="space-y-2">
                      <Label>Main Image</Label>
                      <div className="relative w-full rounded-lg overflow-hidden border border-border bg-muted/30">
                        {characterPreviewImages[editingCharacterIndex] ? (
                          <div className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={characterPreviewImages[editingCharacterIndex]}
                              alt={formData.characters[editingCharacterIndex].name || "Character"}
                              className="w-full h-auto"
                            />
                            <button
                              type="button"
                              onClick={() => handleCharacterMainImageClick(editingCharacterIndex)}
                              disabled={uploadingCharacterIndex === editingCharacterIndex}
                              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                              aria-label="Upload character main image"
                            >
                              {uploadingCharacterIndex === editingCharacterIndex ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                              ) : (
                                <Camera className="h-8 w-8 text-white" />
                              )}
                            </button>
                          </div>
                        ) : formData.characters[editingCharacterIndex].mainImage &&
                          formData.username ? (
                          <div className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getImageUrl({
                                type: "character",
                                filename: formData.characters[editingCharacterIndex].mainImage!,
                                username: formData.username,
                              })}
                              alt={formData.characters[editingCharacterIndex].name || "Character"}
                              className="w-full h-auto"
                            />
                            <button
                              type="button"
                              onClick={() => handleCharacterMainImageClick(editingCharacterIndex)}
                              disabled={uploadingCharacterIndex === editingCharacterIndex}
                              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                              aria-label="Upload character main image"
                            >
                              {uploadingCharacterIndex === editingCharacterIndex ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                              ) : (
                                <Camera className="h-8 w-8 text-white" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="w-full min-h-[200px] flex items-center justify-center relative group">
                            <User className="h-12 w-12 text-muted-foreground" />
                            <button
                              type="button"
                              onClick={() => handleCharacterMainImageClick(editingCharacterIndex)}
                              disabled={uploadingCharacterIndex === editingCharacterIndex}
                              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                              aria-label="Upload character main image"
                            >
                              {uploadingCharacterIndex === editingCharacterIndex ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                              ) : (
                                <Camera className="h-8 w-8 text-white" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      <input
                        ref={(el) => {
                          characterFileInputRefs.current[editingCharacterIndex] = el;
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleCharacterMainImageChange(e, editingCharacterIndex)}
                        className="hidden"
                        disabled={uploadingCharacterIndex === editingCharacterIndex}
                      />
                    </div>

                    {/* Additional Character Images */}
                    <div className="space-y-2">
                      <Label>Additional Images (Different Angles/Attire)</Label>
                      <div className="columns-2 md:columns-3 gap-4">
                        {(formData.characters[editingCharacterIndex].images || []).map(
                          (image, imageIndex) => (
                            <div
                              key={`${editingCharacterIndex}-${imageIndex}`}
                              className="relative w-full mb-4 break-inside-avoid rounded-lg overflow-hidden border border-border bg-muted/30"
                            >
                              {characterAdditionalPreviewImages[editingCharacterIndex]?.[
                                imageIndex
                              ] ? (
                                <div className="relative group">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={
                                      characterAdditionalPreviewImages[editingCharacterIndex][
                                        imageIndex
                                      ]
                                    }
                                    alt={`${formData.characters?.[editingCharacterIndex]?.name || "Character"} - ${imageIndex + 1}`}
                                    className="w-full h-auto"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCharacterAdditionalImageClick(
                                        editingCharacterIndex,
                                        imageIndex
                                      )
                                    }
                                    disabled={
                                      uploadingCharacterAdditionalIndex?.characterIndex ===
                                        editingCharacterIndex &&
                                      uploadingCharacterAdditionalIndex?.imageIndex === imageIndex
                                    }
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                                    aria-label={`Upload additional character image ${imageIndex + 1}`}
                                  >
                                    {uploadingCharacterAdditionalIndex?.characterIndex ===
                                      editingCharacterIndex &&
                                    uploadingCharacterAdditionalIndex?.imageIndex === imageIndex ? (
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                                    ) : (
                                      <Camera className="h-6 w-6 text-white" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeCharacterAdditionalImage(
                                        editingCharacterIndex,
                                        imageIndex
                                      )
                                    }
                                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-75 hover:opacity-100 transition-opacity z-10"
                                    aria-label={`Remove image ${imageIndex + 1}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : image && formData.username ? (
                                <div className="relative group">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={getImageUrl({
                                      type: "character",
                                      filename: image,
                                      username: formData.username,
                                    })}
                                    alt={`${formData.characters?.[editingCharacterIndex]?.name || "Character"} - ${imageIndex + 1}`}
                                    className="w-full h-auto"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCharacterAdditionalImageClick(
                                        editingCharacterIndex,
                                        imageIndex
                                      )
                                    }
                                    disabled={
                                      uploadingCharacterAdditionalIndex?.characterIndex ===
                                        editingCharacterIndex &&
                                      uploadingCharacterAdditionalIndex?.imageIndex === imageIndex
                                    }
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                                    aria-label={`Upload additional character image ${imageIndex + 1}`}
                                  >
                                    {uploadingCharacterAdditionalIndex?.characterIndex ===
                                      editingCharacterIndex &&
                                    uploadingCharacterAdditionalIndex?.imageIndex === imageIndex ? (
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                                    ) : (
                                      <Camera className="h-6 w-6 text-white" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeCharacterAdditionalImage(
                                        editingCharacterIndex,
                                        imageIndex
                                      )
                                    }
                                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-75 hover:opacity-100 transition-opacity z-10"
                                    aria-label={`Remove image ${imageIndex + 1}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="w-full min-h-[150px] flex items-center justify-center relative group">
                                  <Camera className="h-8 w-8 text-muted-foreground" />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCharacterAdditionalImageClick(
                                        editingCharacterIndex,
                                        imageIndex
                                      )
                                    }
                                    disabled={
                                      uploadingCharacterAdditionalIndex?.characterIndex ===
                                        editingCharacterIndex &&
                                      uploadingCharacterAdditionalIndex?.imageIndex === imageIndex
                                    }
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                                    aria-label={`Upload additional character image ${imageIndex + 1}`}
                                  >
                                    {uploadingCharacterAdditionalIndex?.characterIndex ===
                                      editingCharacterIndex &&
                                    uploadingCharacterAdditionalIndex?.imageIndex === imageIndex ? (
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                                    ) : (
                                      <Camera className="h-6 w-6 text-white" />
                                    )}
                                  </button>
                                </div>
                              )}
                              <input
                                ref={(el) => {
                                  characterAdditionalFileInputRefs.current[
                                    `${editingCharacterIndex}-${imageIndex}`
                                  ] = el;
                                }}
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleCharacterAdditionalImageChange(
                                    e,
                                    editingCharacterIndex,
                                    imageIndex
                                  )
                                }
                                className="hidden"
                                disabled={
                                  uploadingCharacterAdditionalIndex?.characterIndex ===
                                    editingCharacterIndex &&
                                  uploadingCharacterAdditionalIndex?.imageIndex === imageIndex
                                }
                              />
                            </div>
                          )
                        )}
                        <div className="relative w-full mb-4 break-inside-avoid">
                          <button
                            type="button"
                            onClick={() =>
                              handleAddCharacterAdditionalImageClick(editingCharacterIndex)
                            }
                            className="relative w-full min-h-[150px] rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center"
                            aria-label="Add additional character image"
                          >
                            <Plus className="h-8 w-8 text-muted-foreground" />
                            <input
                              ref={(el) => {
                                characterAddImageInputRefs.current[editingCharacterIndex] = el;
                              }}
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleAddCharacterAdditionalImageChange(e, editingCharacterIndex)
                              }
                              className="hidden"
                              disabled={
                                uploadingCharacterAdditionalIndex?.characterIndex ===
                                editingCharacterIndex
                              }
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Character Appearance */}
                    <div className="space-y-2">
                      <Label htmlFor={`character-appearance-${editingCharacterIndex}`}>
                        Appearance
                      </Label>
                      <Textarea
                        id={`character-appearance-${editingCharacterIndex}`}
                        placeholder="Describe this character's appearance..."
                        value={formData.characters[editingCharacterIndex].appearance}
                        onChange={(e) =>
                          updateCharacter(editingCharacterIndex, "appearance", e.target.value)
                        }
                        rows={3}
                        className="bg-background resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={addCharacter}
                className="bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Character
              </Button>
            </div>
          </div>

          {/* Scenes Section */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Scenes</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add scenes to your film. Each scene can have its own screenplay text, characters, and
              generated images/videos.
            </p>

            <SceneList
              projectId={projectId || "new-project"}
              scenes={formData.scenes || []}
              characters={formData.characters || []}
              screenplayText={formData.screenplayText}
              onScenesChange={(scenes) => setFormData({ ...formData, scenes })}
            />
          </div>

          {/* Full Width Sections - Links, Tools, Screenplay */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Project Links</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add links to your project (YouTube, Vimeo, Instagram, etc.)
            </p>

            <div className="space-y-3">
              {formData.links.links.map((link, index) => (
                <div
                  key={`${link.label}-${link.url}-${index}`}
                  className="flex items-center gap-2 p-3 bg-muted/30 rounded-md"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{link.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLink(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <Input
                  placeholder="Enter URL (e.g., https://youtube.com/watch?v=...)"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLink();
                    }
                  }}
                  className="bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLink}
                  className="bg-transparent"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Tools</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add the tools you used, organized by category
            </p>

            {/* Add tools by category */}
            <div className="space-y-4">
              {(["video", "image", "sound", "other"] as ToolCategory[]).map((category) => {
                const toolsInCategory = getToolsByCategory(category);
                return (
                  <div key={category} className="space-y-2">
                    <Label htmlFor={`tool-${category}`}>
                      {getCategoryLabel(category)}
                      {category === "video" && !hasVideoTool && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    {/* Display added tools for this category */}
                    {toolsInCategory.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {toolsInCategory.map((tool, _index) => {
                          const globalIndex = formData.tools.indexOf(tool);
                          return (
                            <div
                              key={`${category}-${tool.name}-${globalIndex}`}
                              className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                            >
                              <span>{tool.name}</span>
                              <button
                                type="button"
                                onClick={() => removeTool(globalIndex)}
                                className="hover:text-primary/70 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Select
                        value={selectedTool[category]}
                        onValueChange={(value) => {
                          setSelectedTool({ ...selectedTool, [category]: value });
                          if (value !== "Other") {
                            // Auto-add tool when selected (not "Other")
                            addTool(category, value);
                          } else {
                            setCustomToolInput({ ...customToolInput, [category]: "" });
                          }
                        }}
                        key={`tool-select-${category}`}
                      >
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue
                            placeholder={`Add ${getCategoryLabel(category).toLowerCase()} tool...`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_TOOLS[category].map((tool) => (
                            <SelectItem key={tool} value={tool}>
                              {tool}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTool[category] === "Other" && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter custom tool"
                            value={customToolInput[category]}
                            onChange={(e) =>
                              setCustomToolInput({ ...customToolInput, [category]: e.target.value })
                            }
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTool(category);
                              }
                            }}
                            className="flex-1 bg-background"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addTool(category)}
                            disabled={!customToolInput[category].trim()}
                            className="bg-transparent"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {category === "video" && !hasVideoTool && (
                      <p className="text-xs text-destructive pb-2">
                        * At least one Video Generation tool is required
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <File className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Screenplay / Script</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter your screenplay text or upload a PDF
            </p>

            {/* Screenplay Text Input */}
            <div className="space-y-2">
              <Label htmlFor="screenplayText">Screenplay Text</Label>
              <Textarea
                id="screenplayText"
                placeholder="INT. COFFEE SHOP - DAY

A cozy corner cafe. SARAH (30s) sits alone at a table, staring at her phone...

SARAH
(to herself)
Where is he?

..."
                value={formData.screenplayText || ""}
                onChange={(e) => setFormData({ ...formData, screenplayText: e.target.value })}
                rows={15}
                className="bg-background resize-y font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use standard screenplay format with INT./EXT. scene headings to enable automatic
                scene extraction
              </p>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border" />
              <span className="flex-shrink mx-4 text-xs text-muted-foreground">
                or upload a PDF
              </span>
              <div className="flex-grow border-t border-border" />
            </div>

            <div className="space-y-3">
              {/* Display uploaded screenplay */}
              {formData.screenplay && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                  <File className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{formData.screenplay.name}</p>
                    {formData.screenplay.size && (
                      <p className="text-xs text-muted-foreground">
                        {(formData.screenplay.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeScreenplay}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Upload button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleProjectFileClick}
                disabled={isUploadingFile}
                className="w-full bg-transparent"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploadingFile
                  ? "Uploading..."
                  : formData.screenplay
                    ? "Replace Screenplay"
                    : "Upload Screenplay"}
              </Button>

              {/* Hidden file input */}
              <input
                ref={projectFileInputRef}
                type="file"
                onChange={handleProjectFileChange}
                className="hidden"
                disabled={isUploadingFile}
                accept=".pdf,application/pdf"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              className="flex-1 bg-transparent"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
